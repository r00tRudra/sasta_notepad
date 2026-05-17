from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models import Folder, Note, User
from ..schemas import FolderCreate, FolderOut, NoteListItem
from ..dependencies import get_db
from ..services.folder_service import delete_folder

router = APIRouter(prefix="/folders", tags=["folders"])

@router.post("/{user_id}/folders", response_model=FolderOut, status_code=201)
async def create_folder(user_id: int, folder: FolderCreate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    db_folder = Folder(name=folder.name, user_id=user_id)
    db.add(db_folder)
    await db.commit()
    await db.refresh(db_folder)
    return db_folder

@router.get("/{folder_id}", response_model=FolderOut)
async def get_folder(folder_id: int, db: AsyncSession = Depends(get_db)):
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    return folder

@router.put("/{folder_id}", response_model=FolderOut)
async def rename_folder(folder_id: int, folder: FolderCreate, db: AsyncSession = Depends(get_db)):
    db_folder = await db.get(Folder, folder_id)
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    db_folder.name = folder.name
    db.add(db_folder)
    await db.commit()
    await db.refresh(db_folder)
    return db_folder

@router.delete("/{folder_id}", status_code=204)
async def remove_folder(folder_id: int, db: AsyncSession = Depends(get_db)):
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    await delete_folder(db, folder)
    return None

@router.get("/{folder_id}/notes", response_model=list[NoteListItem])
async def list_notes(folder_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.folder_id == folder_id))
    notes = result.scalars().all()
    return [NoteListItem.model_validate(note) for note in notes]

