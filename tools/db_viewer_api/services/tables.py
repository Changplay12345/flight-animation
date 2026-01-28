# file: services/tables.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def get_tables(engine: AsyncEngine, schema: str) -> list[dict]:
    query = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = :schema
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    async with engine.connect() as conn:
        result = await conn.execute(query, {"schema": schema})
        rows = result.fetchall()
    return [{"table_name": row[0]} for row in rows]
