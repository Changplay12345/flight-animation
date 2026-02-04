# file: services/parquet_export.py
"""
Parquet export service for flight feature datasets.
Exports PostgreSQL data to Parquet files for fast frontend loading.
Uploads to Cloudflare R2 for CDN-backed downloads.
"""
import os
import re
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine
from .r2_storage import upload_parquet_to_r2, check_parquet_exists_in_r2, get_parquet_public_url

# Directory for parquet files (local cache)
PARQUET_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "parquet")
os.makedirs(PARQUET_DIR, exist_ok=True)


def get_parquet_key(dataset: str, dep: str = None, dest: str = None) -> str:
    """Get the R2 object key (filename) for a parquet file"""
    dataset_safe = re.sub(r'[^a-zA-Z0-9_]', '_', dataset)
    filename = dataset_safe
    if dep:
        filename += f"_dep_{dep}"
    if dest:
        filename += f"_dest_{dest}"
    filename += ".parquet"
    return filename


def get_parquet_path(dataset: str, dep: str = None, dest: str = None) -> str:
    """Get the local path for a parquet file"""
    filename = get_parquet_key(dataset, dep, dest)
    return os.path.join(PARQUET_DIR, filename)


def parquet_exists(dataset: str, dep: str = None, dest: str = None) -> dict:
    """Check if parquet file exists in R2 or locally and return info"""
    object_key = get_parquet_key(dataset, dep, dest)
    path = get_parquet_path(dataset, dep, dest)
    
    # First check R2
    if check_parquet_exists_in_r2(object_key):
        r2_url = get_parquet_public_url(object_key)
        return {
            "exists": True,
            "r2_url": r2_url,
            "path": path,
            "source": "r2"
        }
    
    # Fall back to local check
    if os.path.exists(path):
        size = os.path.getsize(path)
        mtime = os.path.getmtime(path)
        return {
            "exists": True,
            "path": path,
            "size_bytes": size,
            "size_mb": round(size / 1024 / 1024, 2),
            "modified": mtime,
            "source": "local"
        }
    return {"exists": False, "path": path}


async def generate_parquet(
    engine: AsyncEngine,
    dataset: str,
    dep: str = None,
    dest: str = None,
    force: bool = False
) -> dict:
    """
    Generate a Parquet file from a flight feature dataset.
    Uses pandas to read from PostgreSQL and write to Parquet.
    """
    dataset_safe = re.sub(r'[^a-zA-Z0-9_]', '_', dataset)
    parquet_path = get_parquet_path(dataset, dep, dest)
    
    # Check if already exists
    if not force and os.path.exists(parquet_path):
        info = parquet_exists(dataset, dep, dest)
        return {
            "success": True,
            "cached": True,
            **info
        }
    
    # Build query with filters
    conditions = []
    if dep:
        conditions.append(f"dep = '{dep}'")
    if dest:
        conditions.append(f"dest = '{dest}'")
    
    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)
    
    query = f'SELECT * FROM flight_features."{dataset_safe}" {where_clause} ORDER BY flight_key ASC, time_of_track ASC'
    
    try:
        # Use psycopg2 directly for sync connection
        import psycopg2
        
        conn = psycopg2.connect(
            host="localhost",
            port=5433,
            user="my_user",
            password="MyStrongPass123!",
            database="my_app_db"
        )
        
        # Read in chunks to avoid memory issues
        chunks = []
        chunk_size = 500000
        offset = 0
        
        while True:
            chunk_query = f"{query} LIMIT {chunk_size} OFFSET {offset}"
            df_chunk = pd.read_sql(chunk_query, conn)
            
            if len(df_chunk) == 0:
                break
                
            chunks.append(df_chunk)
            offset += chunk_size
            
            if len(df_chunk) < chunk_size:
                break
        
        conn.close()
        
        if not chunks:
            return {"success": False, "error": "No data found"}
        
        # Combine chunks
        df = pd.concat(chunks, ignore_index=True)
        
        # Write to parquet with gzip compression (DuckDB WASM has issues with snappy)
        table = pa.Table.from_pandas(df)
        pq.write_table(
            table,
            parquet_path,
            compression='gzip',
            use_dictionary=True,
            write_statistics=True
        )
        
        # Upload to R2 for CDN-backed downloads
        object_key = get_parquet_key(dataset, dep, dest)
        try:
            r2_url = upload_parquet_to_r2(parquet_path, object_key)
            size = os.path.getsize(parquet_path)
            return {
                "success": True,
                "cached": False,
                "rows": len(df),
                "r2_url": r2_url,
                "size_bytes": size,
                "size_mb": round(size / 1024 / 1024, 2),
                "source": "r2"
            }
        except Exception as upload_error:
            # R2 upload failed, fall back to local
            info = parquet_exists(dataset, dep, dest)
            return {
                "success": True,
                "cached": False,
                "rows": len(df),
                "r2_upload_error": str(upload_error),
                **info
            }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


async def list_parquet_files() -> list[dict]:
    """List all available parquet files"""
    files = []
    if os.path.exists(PARQUET_DIR):
        for filename in os.listdir(PARQUET_DIR):
            if filename.endswith('.parquet'):
                path = os.path.join(PARQUET_DIR, filename)
                size = os.path.getsize(path)
                files.append({
                    "filename": filename,
                    "dataset": filename.replace('.parquet', ''),
                    "size_bytes": size,
                    "size_mb": round(size / 1024 / 1024, 2)
                })
    return files
