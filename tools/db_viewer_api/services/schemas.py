# file: services/schemas.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def get_schemas(engine: AsyncEngine) -> list[dict]:
    query = text("""
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
    """)
    async with engine.connect() as conn:
        result = await conn.execute(query)
        rows = result.fetchall()
    return [{"schema_name": row[0]} for row in rows]
