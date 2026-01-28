# Test the create dataset function
import asyncio
from sqlalchemy import text
from db import engine

async def test():
    date_str = "2024-07-27"
    date_compact = date_str.replace('-', '')
    sur_air_table = f"cat062_{date_compact}"
    dataset_name = f"flight_data_{date_compact}"
    
    print(f"sur_air_table: {sur_air_table}")
    print(f"dataset_name: {dataset_name}")
    
    # Check sur_air table exists
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'sur_air' AND table_name = :table_name
        """), {"table_name": sur_air_table})
        row = result.fetchone()
        print(f"sur_air table exists: {row}")
    
    # Find track table
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'track'
        """))
        rows = result.fetchall()
        print(f"track tables: {[r[0] for r in rows]}")
    
    # Try to create schema
    async with engine.begin() as conn:
        await conn.execute(text('CREATE SCHEMA IF NOT EXISTS flight_features'))
        print("Schema created/exists")
    
    # Try DROP
    async with engine.begin() as conn:
        await conn.execute(text(f'DROP TABLE IF EXISTS flight_features."{dataset_name}"'))
        print("DROP executed")
    
    # Try simple CREATE without JOIN
    create_sql = f'''
        CREATE TABLE flight_features."{dataset_name}" AS
        SELECT * FROM sur_air."{sur_air_table}" LIMIT 10
    '''
    print(f"SQL: {create_sql}")
    
    async with engine.begin() as conn:
        await conn.execute(text(create_sql))
        print("CREATE executed")
    
    # Count
    async with engine.connect() as conn:
        result = await conn.execute(text(f'SELECT COUNT(*) FROM flight_features."{dataset_name}"'))
        count = result.scalar()
        print(f"Row count: {count}")

asyncio.run(test())
