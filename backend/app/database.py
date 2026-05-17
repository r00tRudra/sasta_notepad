import os
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
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
connect_args = {}

if raw_db_url:
    # Support shorthand `postgres://` by normalizing to `postgresql://`.
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

    # If a Postgres URL is provided without a driver suffix, add asyncpg.
    if raw_db_url.startswith("postgresql://") and "+" not in raw_db_url:
        DATABASE_URL = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        DATABASE_URL = raw_db_url

    # Remove libpq-only params that asyncpg does not accept, and map sslmode to ssl.
    if DATABASE_URL.startswith("postgresql+asyncpg://"):
        parsed = urlparse(DATABASE_URL)
        pairs = parse_qsl(parsed.query, keep_blank_values=True)

        filtered = []
        sslmode_value = None
        has_ssl_param = False

        for key, value in pairs:
            key_lower = key.lower()
            if key_lower == "sslmode":
                sslmode_value = value
                continue
            if key_lower == "channel_binding":
                continue
            if key_lower == "ssl":
                has_ssl_param = True
                continue
            filtered.append((key, value))

        # Map sslmode/ssl to asyncpg connect_args and strip from URL.
        if sslmode_value and sslmode_value.lower() != "disable":
            connect_args["ssl"] = True
        elif has_ssl_param:
            connect_args["ssl"] = True

        new_query = urlencode(filtered, doseq=True)
        DATABASE_URL = urlunparse(parsed._replace(query=new_query))
        os.environ["DATABASE_URL"] = DATABASE_URL
else:
    # Always require DATABASE_URL explicitly; no local SQLite fallback.
    raise RuntimeError("DATABASE_URL is required; no fallback is allowed")

engine = create_async_engine(DATABASE_URL, echo=True, future=True, connect_args=connect_args)
AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False, autocommit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
