import mistune
from ..models import Note
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from datetime import datetime

markdown_parser = mistune.create_markdown(
    plugins=[
        'strikethrough', 'footnotes', 'table', 'url', 'task_lists', 'def_list', 'abbr', 'mark', 'superscript', 'subscript',
    ]
)

def parse_markdown(content: str) -> str:
    return markdown_parser(content)

async def create_note(session: AsyncSession, folder_id: int, title: str, content: str) -> Note:
    content_html = parse_markdown(content)
    note = Note(
        title=title,
        content=content,
        content_html=content_html,
        folder_id=folder_id,
    )
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note

async def update_note(session: AsyncSession, note: Note, title: str = None, content: str = None) -> Note:
    if title is not None:
        note.title = title
    if content is not None:
        note.content = content
        note.content_html = parse_markdown(content)
    note.updated_at = datetime.utcnow()
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note
