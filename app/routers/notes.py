from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models import Note, Folder
from ..schemas import NoteCreate, NoteUpdate, NoteOut, NoteListItem
from ..dependencies import get_db
from ..services.notes_service import create_note, update_note

router = APIRouter(prefix="/notes", tags=["notes"])

@router.post("/folders/{folder_id}/notes", response_model=NoteOut, status_code=201)
async def create_note_endpoint(folder_id: int, note: NoteCreate, db: AsyncSession = Depends(get_db)):
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    db_note = await create_note(db, folder_id, note.title, note.content)
    return db_note

@router.get("/{note_id}", response_model=NoteOut)
async def get_note(note_id: int, db: AsyncSession = Depends(get_db)):
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note

@router.put("/{note_id}", response_model=NoteOut)
async def update_note_endpoint(note_id: int, note: NoteUpdate, db: AsyncSession = Depends(get_db)):
    db_note = await db.get(Note, note_id)
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found.")
    updated_note = await update_note(db, db_note, note.title, note.content)
    return updated_note

@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: int, db: AsyncSession = Depends(get_db)):
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    await db.delete(note)
    await db.commit()
    return None
