import asyncio
from app.database import engine, AsyncSessionLocal
from app.models import Base, User, Folder, Note
from app.services.notes_service import parse_markdown

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        user = User(username="demo")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        folder1 = Folder(name="Work", user_id=user.id)
        folder2 = Folder(name="Personal", user_id=user.id)
        session.add_all([folder1, folder2])
        await session.commit()
        await session.refresh(folder1)
        await session.refresh(folder2)
        notes = [
            Note(
                title="Welcome Note",
                content="# Welcome\nThis is a **markdown** note!",
                content_html=parse_markdown("# Welcome\nThis is a **markdown** note!"),
                folder_id=folder1.id,
            ),
            Note(
                title="Todo List",
                content="- [x] Write code\n- [ ] Test app",
                content_html=parse_markdown("- [x] Write code\n- [ ] Test app"),
                folder_id=folder1.id,
            ),
            Note(
                title="Personal Thoughts",
                content="> Blockquotes are cool!\n\n---\n\nSome *italic* text.",
                content_html=parse_markdown("> Blockquotes are cool!\n\n---\n\nSome *italic* text."),
                folder_id=folder2.id,
            ),
        ]
        session.add_all(notes)
        await session.commit()
    print("Seeded sample data.")

if __name__ == "__main__":
    asyncio.run(seed())
