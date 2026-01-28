# file: db.py
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://my_user:MyStrongPass123!@localhost:5433/my_app_db"

engine = create_async_engine(DATABASE_URL, echo=False)
