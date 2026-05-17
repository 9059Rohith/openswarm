from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path
import json


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    DATABASE_URL: str = "sqlite+aiosqlite:///./lexguard.db"
    UPLOAD_DIR: str = "./uploads"
    SECRET_KEY: str = "lexguard-super-secret-jwt-key-2024-change-this-please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:3001","http://127.0.0.1:3000","https://lexguard.vercel.app","https://lexguard-frontend.vercel.app","https://lexguard-frontend-22259513516.us-central1.run.app","https://lexguard-backend-22259513516.us-central1.run.app"]'
    MAX_FILE_SIZE_MB: int = 20
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GEMINI_MODEL: str = "gemini-2.0-flash"

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            origins = json.loads(self.CORS_ORIGINS)
            # Always allow all vercel.app and render.com preview URLs
            return origins
        except Exception:
            return ["http://localhost:3000"]

    class Config:
        env_file = str(Path(__file__).parent / ".env")
        extra = "ignore"


settings = Settings()
