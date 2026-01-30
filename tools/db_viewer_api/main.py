# file: main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import os

from db import engine
from services import schemas, tables, data, flight_features
from services import parquet_export
from services.r2_storage import list_parquets_in_r2

app = FastAPI(title="DB Viewer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/schemas")
async def get_schemas():
    return await schemas.get_schemas(engine)


@app.get("/tables")
async def get_tables(schema: str = "public"):
    return await tables.get_tables(engine, schema)


@app.get("/columns")
async def get_columns(schema: str = "public", table: str = ""):
    return await data.get_columns(engine, schema, table)


@app.get("/count")
async def get_count(schema: str = "public", table: str = ""):
    return await data.get_row_count(engine, schema, table)


@app.get("/rows")
async def get_rows(schema: str = "public", table: str = "", limit: int = 50, offset: int = 0):
    return await data.get_rows(engine, schema, table, limit, offset)


# ============== Flight Features Endpoints ==============

@app.get("/flight-features/dates")
async def get_dates():
    """Get available dates from sur_air schema"""
    return await flight_features.get_available_sur_air_dates(engine)


@app.get("/flight-features/airports")
async def get_airports(date: str):
    """Get available airports (dep/dest) for a given date"""
    return await flight_features.get_airports_for_date(engine, date)


@app.get("/flight-features/preview-count")
async def get_preview_count(date: str, airport: str = ""):
    """Get row count preview for a date with optional airport filter"""
    return await flight_features.get_row_count_for_filter(engine, date, airport or None)


@app.get("/flight-features/datasets")
async def list_datasets():
    """List all flight feature datasets available in R2"""
    return list_parquets_in_r2()


@app.post("/flight-features/create")
async def create_dataset(date: str, name: str = "", airport: str = ""):
    """Create a new flight feature dataset by joining sur_air and track"""
    return await flight_features.create_flight_feature_dataset(
        engine, date, 
        dataset_name=name or None,
        airport_filter=airport or None
    )


@app.get("/flight-features/preview")
async def preview_dataset(dataset: str, limit: int = 50, offset: int = 0):
    """Preview rows from a flight feature dataset"""
    return await flight_features.export_dataset_preview(engine, dataset, limit, offset)


@app.delete("/flight-features/delete")
async def delete_dataset(dataset: str):
    """Delete a flight feature dataset"""
    return await flight_features.delete_flight_feature_dataset(engine, dataset)


@app.get("/flight-features/airports-from-dataset")
async def get_airports_from_dataset(dataset: str):
    """Get unique airport codes from a dataset"""
    return await flight_features.get_airport_codes(engine, dataset)


@app.get("/flight-features/count")
async def get_count_filtered(dataset: str, dep: str = "", dest: str = ""):
    """Get row count for dataset with optional filters"""
    return await flight_features.get_dataset_row_count(
        engine, dataset,
        dep_filter=dep if dep else None,
        dest_filter=dest if dest else None
    )


@app.get("/flight-features/export")
async def export_filtered(dataset: str, dep: str = "", dest: str = "", limit: int = 0, offset: int = 0, batch_size: int = 50000):
    """Export dataset filtered by airport codes with pagination support"""
    return await flight_features.export_dataset_filtered(
        engine, dataset, 
        dep_filter=dep if dep else None,
        dest_filter=dest if dest else None,
        limit=limit if limit > 0 else None,
        offset=offset,
        batch_size=batch_size
    )


# ============== Parquet Endpoints ==============

@app.post("/flight-features/parquet/generate")
async def generate_parquet(dataset: str, dep: str = "", dest: str = "", force: bool = False):
    """Generate a Parquet file from a flight feature dataset"""
    return await parquet_export.generate_parquet(
        engine, dataset,
        dep=dep if dep else None,
        dest=dest if dest else None,
        force=force
    )


@app.get("/flight-features/parquet/check")
async def check_parquet(dataset: str, dep: str = "", dest: str = ""):
    """Check if a Parquet file exists for the dataset"""
    return parquet_export.parquet_exists(
        dataset,
        dep=dep if dep else None,
        dest=dest if dest else None
    )


@app.get("/flight-features/parquet/list")
async def list_parquet_files():
    """List all available Parquet files from R2 bucket"""
    return list_parquets_in_r2()


@app.get("/flight-features/parquet/download")
async def download_parquet(dataset: str, dep: str = "", dest: str = ""):
    """Download the Parquet file for a dataset - redirects to R2 if available"""
    from fastapi.responses import RedirectResponse
    
    info = parquet_export.parquet_exists(
        dataset,
        dep=dep if dep else None,
        dest=dest if dest else None
    )
    
    if not info["exists"]:
        return {"error": "Parquet file not found. Generate it first."}
    
    # If R2 URL is available, redirect to it for faster CDN download
    if "r2_url" in info:
        return RedirectResponse(url=info["r2_url"], status_code=302)
    
    # Fall back to local file serving
    return FileResponse(
        info["path"],
        media_type="application/octet-stream",
        filename=os.path.basename(info["path"])
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
