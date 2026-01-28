# Temporary script to check database structure
import asyncio
from sqlalchemy import text
from db import engine

async def check():
    async with engine.connect() as conn:
        # List all tables in all schemas
        result = await conn.execute(text("""
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
            LIMIT 50
        """))
        print("=== Tables ===")
        for row in result.fetchall():
            print(f"{row[0]}.{row[1]}")
        
        # Check if there's a partitioned table structure
        result2 = await conn.execute(text("""
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE schemaname IN ('sur_air', 'public')
            ORDER BY schemaname, tablename
            LIMIT 50
        """))
        print("\n=== pg_tables ===")
        for row in result2.fetchall():
            print(f"{row[0]}.{row[1]}")

asyncio.run(check())
