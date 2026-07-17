from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings
import os

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

db_url = settings.DATABASE_URL

if db_url.startswith("postgresql"):
    # Cloud Run connects via Unix socket: ?host=/cloudsql/INSTANCE
    engine = create_async_engine(db_url, echo=False, pool_size=5, max_overflow=10)
else:
    # SQLite for local dev
    engine = create_async_engine(
        db_url,
        echo=False,
        connect_args={"check_same_thread": False},
    )

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
