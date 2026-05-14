from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models import Folder, Note
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

async def delete_folder(session: AsyncSession, folder: Folder):
    notes_count = await session.scalar(select(Note).where(Note.folder_id == folder.id).limit(1))
    if notes_count:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder is not empty.")
    await session.delete(folder)
    await session.commit()
