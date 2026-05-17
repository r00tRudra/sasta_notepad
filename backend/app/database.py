import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# Read DATABASE_URL from environment. Normalize common Postgres scheme
# variants and ensure an async driver is used for async engines. In
# production require `DATABASE_URL` to be set; for development fall back
# to a local SQLite file.
raw_db_url = os.getenv("DATABASE_URL")
env = os.getenv("ENV", "development").lower()

if raw_db_url:
    # Support shorthand `postgres://` by normalizing to `postgresql://`.
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

    # If a Postgres URL is provided without a driver suffix, add asyncpg.
    if raw_db_url.startswith("postgresql://") and "+" not in raw_db_url:
        DATABASE_URL = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        DATABASE_URL = raw_db_url
else:
    # Always require DATABASE_URL explicitly; no local SQLite fallback.
    raise RuntimeError("DATABASE_URL is required; no fallback is allowed")

engine = create_async_engine(DATABASE_URL, echo=True, future=True)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False, autocommit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
