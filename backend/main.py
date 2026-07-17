from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config import settings
from database import init_db
from routers import auth, analyze, contracts, chat, playbooks, export, recommendations, daily_brief
from routers import swarm_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    print("[OK] LexGuard Backend started successfully")
    print(f"   Database: {settings.DATABASE_URL}")
    print(f"   Upload dir: {settings.UPLOAD_DIR}")
    print(f"   Groq model: {settings.GROQ_MODEL}")
    yield
    # Shutdown
    print("[SHUTDOWN] LexGuard Backend shutting down")


app = FastAPI(
    title="LexGuard API",
    description="AI-Powered Contract Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^http://localhost:\d+$|^http://127\.0\.0\.1:\d+$|https://.*\.(vercel\.app|onrender\.com|run\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(chat.router)
app.include_router(contracts.router)
app.include_router(playbooks.router)
app.include_router(export.router)
app.include_router(swarm_status.router)
app.include_router(recommendations.router)
app.include_router(daily_brief.router)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "LexGuard API",
        "version": "1.0.0",
    }


@app.get("/")
async def root():
    return {
        "message": "LexGuard AI — Contract Intelligence Platform",
        "docs": "/docs",
        "health": "/health",
    }
