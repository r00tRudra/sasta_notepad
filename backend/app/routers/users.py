from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..models import User, Folder
from ..schemas import UserCreate, UserOut, FolderOut
from ..dependencies import get_db
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserOut, status_code=201)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    if len(user.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password must be 72 bytes or fewer.")
    hashed_password = pwd_context.hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    try:
        await db.commit()
        await db.refresh(db_user)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Username already exists.")
    return db_user

@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user

@router.get("/{user_id}/folders", response_model=list[FolderOut])
async def list_folders(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Folder).where(Folder.user_id == user_id))
    folders = result.scalars().all()
    return folders
