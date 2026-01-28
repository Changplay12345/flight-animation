# file: services/data.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def get_columns(engine: AsyncEngine, schema: str, table: str) -> list[dict]:
    query = text("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = :schema AND table_name = :table
        ORDER BY ordinal_position
    """)
    async with engine.connect() as conn:
        result = await conn.execute(query, {"schema": schema, "table": table})
        rows = result.fetchall()
    return [
        {
            "column_name": row[0],
            "data_type": row[1],
            "is_nullable": row[2],
            "column_default": row[3],
        }
        for row in rows
    ]


async def get_row_count(engine: AsyncEngine, schema: str, table: str) -> dict:
    """Fast count query - doesn't load any data"""
    if not schema.isidentifier() or not table.isidentifier():
        return {"count": 0, "error": "Invalid schema or table name"}
    
    query = text(f'SELECT COUNT(*) FROM "{schema}"."{table}"')
    async with engine.connect() as conn:
        result = await conn.execute(query)
        count = result.scalar()
    return {"count": count}


async def get_rows(
    engine: AsyncEngine,
    schema: str,
    table: str,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Paginated rows - only fetches what's needed"""
    if not schema.isidentifier() or not table.isidentifier():
        return {"columns": [], "rows": [], "error": "Invalid schema or table name"}

    # Clamp limit to prevent huge fetches
    limit = min(limit, 500)

    query = text(f'SELECT * FROM "{schema}"."{table}" LIMIT :limit OFFSET :offset')
    async with engine.connect() as conn:
        result = await conn.execute(query, {"limit": limit, "offset": offset})
        columns = list(result.keys())
        rows = result.fetchall()

    # Convert rows to dicts with string serialization for JSON
    data = []
    for row in rows:
        record = {}
        for i, col in enumerate(columns):
            val = row[i]
            # Convert non-JSON-serializable types to string
            if val is None:
                record[col] = None
            elif isinstance(val, float):
                # Handle NaN and Inf which are not JSON compliant
                import math
                if math.isnan(val) or math.isinf(val):
                    record[col] = None
                else:
                    record[col] = val
            elif isinstance(val, (int, bool, str)):
                record[col] = val
            else:
                record[col] = str(val)
        data.append(record)

    return {
        "columns": columns,
        "rows": data,
        "limit": limit,
        "offset": offset,
    }
