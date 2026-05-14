from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

class UserCreate(BaseModel):
    username: str

class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FolderCreate(BaseModel):
    name: str

class FolderOut(BaseModel):
    id: int
    name: str
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NoteCreate(BaseModel):
    title: str
    content: str

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class NoteOut(BaseModel):
    id: int
    title: str
    content: str
    content_html: str
    folder_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NoteListItem(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
