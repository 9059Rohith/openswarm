from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

from database import get_db
from models.contract import User
from models.schemas import UserCreate, UserLogin, UserOut, Token
from auth import verify_password, get_password_hash, create_access_token, get_current_user
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_EMAIL = "demo@lexguard.ai"
DEMO_PASSWORD = "demo1234"
DEMO_FULL_NAME = "Demo User"


def is_demo_login(credentials: UserLogin) -> bool:
    return (
        credentials.email.strip().lower() == DEMO_EMAIL
        and credentials.password == DEMO_PASSWORD
    )


async def get_or_create_demo_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    user = result.scalar_one_or_none()
    if user:
        user.full_name = DEMO_FULL_NAME
        user.hashed_password = get_password_hash(DEMO_PASSWORD)
        user.is_active = True
    else:
        user = User(
            email=DEMO_EMAIL,
            full_name=DEMO_FULL_NAME,
            hashed_password=get_password_hash(DEMO_PASSWORD),
            is_active=True,
        )
        db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    if is_demo_login(credentials):
        user = await get_or_create_demo_user(db)
    else:
        result = await db.execute(select(User).where(User.email == credentials.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(credentials.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is deactivated",
        )

    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
