# file: services/flight_features.py
import re
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def get_available_sur_air_dates(engine: AsyncEngine) -> list[dict]:
    """
    Get list of available dates from sur_air schema.
    Tables are named like: cat062_YYYYMMDD
    """
    query = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'sur_air'
        ORDER BY table_name DESC
    """)
    async with engine.connect() as conn:
        result = await conn.execute(query)
        rows = result.fetchall()
    
    dates = []
    for row in rows:
        table_name = row[0]
        # Extract date from table name like cat062_20240727
        match = re.search(r'(\d{4})(\d{2})(\d{2})$', table_name)
        if match:
            year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
            date_str = f"{year:04d}-{month:02d}-{day:02d}"
            dates.append({
                "date": date_str,
                "year": year,
                "month": month,
                "day": day,
                "table_name": table_name,
            })
    return dates


async def get_sur_air_columns(engine: AsyncEngine, table_name: str) -> list[str]:
    """Get all column names from a sur_air table"""
    query = text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'sur_air' AND table_name = :table_name
        ORDER BY ordinal_position
    """)
    async with engine.connect() as conn:
        result = await conn.execute(query, {"table_name": table_name})
        rows = result.fetchall()
    return [row[0] for row in rows]


async def get_track_columns(engine: AsyncEngine, table_name: str) -> list[str]:
    """Get all column names from a track table, excluding geom"""
    query = text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'track' AND table_name = :table_name AND column_name != 'geom'
        ORDER BY ordinal_position
    """)
    async with engine.connect() as conn:
        result = await conn.execute(query, {"table_name": table_name})
        rows = result.fetchall()
    return [row[0] for row in rows]


async def get_airports_for_date(engine: AsyncEngine, date_str: str) -> list[str]:
    """
    Get unique airport codes (dep and dest) from sur_air table for a given date.
    """
    date_compact = date_str.replace('-', '')
    sur_air_table = f"cat062_{date_compact}"
    
    query = text(f"""
        SELECT DISTINCT airport FROM (
            SELECT dep AS airport FROM sur_air."{sur_air_table}" WHERE dep IS NOT NULL AND dep != ''
            UNION
            SELECT dest AS airport FROM sur_air."{sur_air_table}" WHERE dest IS NOT NULL AND dest != ''
        ) AS airports
        ORDER BY airport
    """)
    
    try:
        async with engine.connect() as conn:
            result = await conn.execute(query)
            rows = result.fetchall()
        return [row[0] for row in rows if row[0]]
    except Exception:
        return []


async def get_row_count_for_filter(engine: AsyncEngine, date_str: str, airport_filter: str | None = None) -> dict:
    """
    Get row count for a date with optional airport filter.
    """
    date_compact = date_str.replace('-', '')
    sur_air_table = f"cat062_{date_compact}"
    
    where_clause = ""
    if airport_filter:
        airport_filter = re.sub(r'[^a-zA-Z0-9]', '', airport_filter).upper()
        where_clause = f"WHERE (dep = '{airport_filter}' OR dest = '{airport_filter}')"
    
    query = text(f'SELECT COUNT(*) FROM sur_air."{sur_air_table}" {where_clause}')
    
    try:
        async with engine.connect() as conn:
            result = await conn.execute(query)
            count = result.scalar()
        return {"count": count, "success": True}
    except Exception as e:
        return {"count": 0, "success": False, "error": str(e)}


async def find_track_table_for_date(engine: AsyncEngine, date_str: str) -> str | None:
    """
    Find a track table that contains data for the given date.
    Track tables are named like: track_cat62_YYYYMM or track_cat62_YYYYMMDD
    """
    year_month = date_str.replace('-', '')[:6]  # YYYYMM
    year_month_day = date_str.replace('-', '')  # YYYYMMDD
    
    query = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'track'
        ORDER BY table_name
    """)
    async with engine.connect() as conn:
        result = await conn.execute(query)
        rows = result.fetchall()
    
    # Look for exact date match first, then month match
    for row in rows:
        table_name = row[0]
        if year_month_day in table_name:
            return table_name
        if year_month in table_name:
            return table_name
    
    return None


def validate_date_format(date_str: str) -> bool:
    """Validate date format is YYYY-MM-DD"""
    pattern = r'^\d{4}-\d{2}-\d{2}$'
    if not re.match(pattern, date_str):
        return False
    try:
        year, month, day = map(int, date_str.split('-'))
        if month < 1 or month > 12 or day < 1 or day > 31:
            return False
        return True
    except ValueError:
        return False


async def ensure_schema_exists(engine: AsyncEngine, schema_name: str = "flight_features"):
    """Create the flight_features schema if it doesn't exist"""
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))


async def create_flight_feature_dataset(
    engine: AsyncEngine,
    date_str: str,
    dataset_name: str | None = None,
    airport_filter: str | None = None,
) -> dict:
    """
    Create a flight feature dataset by joining sur_air and track tables.
    
    - sur_air: schema with tables named cat062_YYYYMMDD
    - track: schema with tables named track_cat62_YYYYMM, filtered by DATE(start_time)
    - LEFT JOIN on flight_key
    - Excludes geom column from track
    - Saves result to flight_features schema
    """
    if not validate_date_format(date_str):
        return {"success": False, "error": "Invalid date format. Use YYYY-MM-DD"}
    
    date_compact = date_str.replace('-', '')  # YYYYMMDD
    
    # Generate dataset name if not provided
    if not dataset_name:
        dataset_name = f"flight_data_{date_compact}"
        if airport_filter:
            dataset_name += f"_{airport_filter.upper()}"
    
    # Sanitize dataset name for SQL
    dataset_name = re.sub(r'[^a-zA-Z0-9_]', '_', dataset_name)
    
    # Sanitize airport filter
    if airport_filter:
        airport_filter = re.sub(r'[^a-zA-Z0-9]', '', airport_filter).upper()
    
    try:
        # Find the sur_air table for this date
        sur_air_table = f"cat062_{date_compact}"
        
        # Check if sur_air table exists
        check_query = text("""
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'sur_air' AND table_name = :table_name
        """)
        async with engine.connect() as conn:
            result = await conn.execute(check_query, {"table_name": sur_air_table})
            if not result.fetchone():
                return {"success": False, "error": f"sur_air table not found: {sur_air_table}"}
        
        # Find matching track table
        track_table = await find_track_table_for_date(engine, date_str)
        
        # Ensure output schema exists
        await ensure_schema_exists(engine)
        
        # Drop existing table first
        async with engine.begin() as conn:
            await conn.execute(text(f'DROP TABLE IF EXISTS flight_features."{dataset_name}"'))
        
        # Build query - LEFT JOIN sur_air with track filtered by date
        # Only include specific columns as per README
        selected_cols = """
            s.track_no,
            s.app_time,
            s.time_of_track,
            s.icao_24bit_dap,
            s.mode_a_code,
            s.acid,
            s.dep,
            s.dest,
            s.latitude,
            s.longitude,
            s.geo_alt,
            s.baro_alt,
            s.measured_fl,
            s.vert,
            s.rate_cd,
            s.ias_dap,
            s.mag_heading_dap,
            s.ground_speed,
            s.sector,
            s.flight_id,
            s.flight_key
        """
        
        # Build WHERE clause for airport filter
        airport_where = ""
        if airport_filter:
            airport_where = f"WHERE (s.dep = '{airport_filter}' OR s.dest = '{airport_filter}')"
        
        if track_table:
            create_sql = f"""
                CREATE TABLE flight_features."{dataset_name}" AS
                SELECT {selected_cols}
                FROM sur_air."{sur_air_table}" s
                LEFT JOIN track."{track_table}" t 
                    ON s.flight_key = t.flight_key 
                    AND DATE(t.start_time) = '{date_str}'
                {airport_where}
                ORDER BY s.flight_key ASC
            """
        else:
            # No track table found, just copy sur_air data with selected columns
            create_sql = f"""
                CREATE TABLE flight_features."{dataset_name}" AS
                SELECT {selected_cols}
                FROM sur_air."{sur_air_table}" s
                {airport_where}
                ORDER BY s.flight_key ASC
            """
        
        async with engine.begin() as conn:
            await conn.execute(text(create_sql))
        
        # Get row count of created table
        count_query = text(f'SELECT COUNT(*) FROM flight_features."{dataset_name}"')
        async with engine.connect() as conn:
            result = await conn.execute(count_query)
            row_count = result.scalar()
        
        # Generate parquet and upload to R2 immediately
        from . import parquet_export
        parquet_result = await parquet_export.generate_parquet(engine, dataset_name)
        
        r2_url = parquet_result.get("r2_url")
        parquet_size_mb = parquet_result.get("size_mb")
        
        return {
            "success": True,
            "dataset_name": dataset_name,
            "schema": "flight_features",
            "table": dataset_name,
            "row_count": row_count,
            "date": date_str,
            "sur_air_table": sur_air_table,
            "track_table": track_table,
            "r2_url": r2_url,
            "parquet_size_mb": parquet_size_mb,
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


async def list_flight_feature_datasets(engine: AsyncEngine) -> list[dict]:
    """List all datasets in the flight_features schema"""
    query = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'flight_features'
        ORDER BY table_name
    """)
    async with engine.connect() as conn:
        result = await conn.execute(query)
        rows = result.fetchall()
    return [{"table_name": row[0]} for row in rows]


async def delete_flight_feature_dataset(engine: AsyncEngine, dataset_name: str) -> dict:
    """Delete a dataset from flight_features schema"""
    # Sanitize name
    dataset_name = re.sub(r'[^a-zA-Z0-9_]', '_', dataset_name)
    
    try:
        async with engine.begin() as conn:
            await conn.execute(text(f'DROP TABLE IF EXISTS flight_features."{dataset_name}"'))
        return {"success": True, "deleted": dataset_name}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def export_dataset_preview(
    engine: AsyncEngine,
    dataset_name: str,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """Get preview rows from a flight feature dataset"""
    dataset_name = re.sub(r'[^a-zA-Z0-9_]', '_', dataset_name)
    limit = min(limit, 500)
    
    try:
        query = text(f'SELECT * FROM flight_features."{dataset_name}" LIMIT :limit OFFSET :offset')
        async with engine.connect() as conn:
            result = await conn.execute(query, {"limit": limit, "offset": offset})
            columns = list(result.keys())
            rows = result.fetchall()
        
        # Convert to JSON-safe format
        data = []
        for row in rows:
            record = {}
            for i, col in enumerate(columns):
                val = row[i]
                if val is None:
                    record[col] = None
                elif isinstance(val, float):
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
    except Exception as e:
        return {"columns": [], "rows": [], "error": str(e)}


async def get_airport_codes(engine: AsyncEngine, dataset_name: str) -> dict:
    """Get unique airport codes (dep/dest) from a dataset"""
    dataset_name = re.sub(r'[^a-zA-Z0-9_]', '_', dataset_name)
    
    try:
        # Get unique dep codes
        dep_query = text(f'SELECT DISTINCT dep FROM flight_features."{dataset_name}" WHERE dep IS NOT NULL AND dep != \'\' ORDER BY dep')
        dest_query = text(f'SELECT DISTINCT dest FROM flight_features."{dataset_name}" WHERE dest IS NOT NULL AND dest != \'\' ORDER BY dest')
        
        async with engine.connect() as conn:
            dep_result = await conn.execute(dep_query)
            dest_result = await conn.execute(dest_query)
            
            dep_codes = [row[0] for row in dep_result.fetchall()]
            dest_codes = [row[0] for row in dest_result.fetchall()]
        
        return {
            "dep_codes": dep_codes,
            "dest_codes": dest_codes,
        }
    except Exception as e:
        return {"dep_codes": [], "dest_codes": [], "error": str(e)}


async def get_dataset_row_count(
    engine: AsyncEngine,
    dataset_name: str,
    dep_filter: str | None = None,
    dest_filter: str | None = None,
) -> dict:
    """Get row count for a dataset with optional filters"""
    dataset_name = re.sub(r'[^a-zA-Z0-9_]', '_', dataset_name)
    
    try:
        conditions = []
        params = {}
        
        if dep_filter:
            conditions.append("dep = :dep")
            params["dep"] = dep_filter
        if dest_filter:
            conditions.append("dest = :dest")
            params["dest"] = dest_filter
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        query = text(f'SELECT COUNT(*) FROM flight_features."{dataset_name}" {where_clause}')
        
        async with engine.connect() as conn:
            result = await conn.execute(query, params)
            count = result.scalar()
        
        return {"count": count}
    except Exception as e:
        return {"count": 0, "error": str(e)}


async def export_dataset_filtered(
    engine: AsyncEngine,
    dataset_name: str,
    dep_filter: str | None = None,
    dest_filter: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    batch_size: int = 50000,
) -> dict:
    """Export dataset filtered by airport codes for use in flight animation.
    Supports pagination with offset and batch_size for large datasets.
    """
    dataset_name = re.sub(r'[^a-zA-Z0-9_]', '_', dataset_name)
    
    try:
        # Build WHERE clause
        conditions = []
        params = {}
        
        if dep_filter:
            conditions.append("dep = :dep")
            params["dep"] = dep_filter
        if dest_filter:
            conditions.append("dest = :dest")
            params["dest"] = dest_filter
        
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Use batch_size for pagination, limit overrides if smaller
        actual_limit = batch_size
        if limit and limit < batch_size:
            actual_limit = limit
        
        params["limit"] = actual_limit
        params["offset"] = offset
        
        query = text(f'SELECT * FROM flight_features."{dataset_name}" {where_clause} ORDER BY flight_key, time_of_track LIMIT :limit OFFSET :offset')
        
        async with engine.connect() as conn:
            result = await conn.execute(query, params)
            columns = list(result.keys())
            rows = result.fetchall()
        
        # Convert to JSON-safe format
        import math
        data = []
        for row in rows:
            record = {}
            for i, col in enumerate(columns):
                val = row[i]
                if val is None:
                    record[col] = None
                elif isinstance(val, float):
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
            "row_count": len(data),
            "offset": offset,
            "batch_size": actual_limit,
            "has_more": len(data) == actual_limit,
            "filters": {"dep": dep_filter, "dest": dest_filter},
        }
    except Exception as e:
        return {"columns": [], "rows": [], "error": str(e)}
