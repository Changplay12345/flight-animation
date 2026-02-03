# Development Setup Guide

This guide covers all servers and services needed for local development and production deployment.

## Local Development Setup

### 1. Frontend (React App)
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
- Runs on: http://localhost:5173
- Auto-detects localhost for API calls

### 2. Database Viewer API (FastAPI)
```bash
cd tools/db_viewer_api

# Install dependencies
pip install -r requirements.txt

# Start API server
python main.py
```
- Runs on: http://localhost:8000
- Provides database schemas, tables, and flight features API

### 3. Cloudflare Tunnel (Optional - for external access)
```bash
# Install cloudflared
npm install -g cloudflared

# Start tunnel to expose local API
cloudflared tunnel --url http://localhost:8000
```
- Generates temporary URL like: `https://struct-staff-seeing-valuation.trycloudflare.com`
- Used when you need external access to local API

## Production Setup (Cloudflare Backend)

### 1. Production API Server
The production API runs on Cloudflare infrastructure. Update `src/config/api.ts`:

```typescript
// For production deployment
export const API_BASE = 'https://your-production-api-url.com';
```

### 2. Environment Variables
Create `.env.production`:
```
VITE_API_BASE=https://your-production-api-url.com
VITE_R2_PUBLIC_URL=https://your-r2-bucket.r2.dev
```

### 3. Deployment Commands
```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

## Server Dependencies

### Frontend Dependencies
- React 18
- Leaflet (maps)
- Zustand (state management)
- DuckDB WASM (data processing)

### Backend Dependencies
- FastAPI
- DuckDB
- Cloudflare R2 SDK
- Uvicorn (ASGI server)

## API Endpoints

### Database API (localhost:8000)
- `GET /schemas` - List database schemas
- `GET /tables?schema={name}` - List tables in schema
- `GET /columns?schema={name}&table={table}` - Table columns
- `GET /rows?schema={name}&table={table}&limit={n}&offset={n}` - Table data
- `GET /count?schema={name}&table={table}` - Row count

### Flight Features API
- `GET /flight-features/dates` - Available dates
- `GET /flight-features/datasets` - Dataset list
- `GET /flight-features/airports?date={date}` - Airport options
- `POST /flight-features/create?{params}` - Create dataset
- `DELETE /flight-features/delete?dataset={name}` - Delete dataset

## Troubleshooting

### API Not Accessible
1. Ensure db_viewer_api is running on port 8000
2. Check if port is blocked: `netstat -an | findstr :8000`
3. Verify API responds: `curl http://localhost:8000/schemas`

### Tunnel Issues
1. Install cloudflared: `npm install -g cloudflared`
2. Check tunnel status: `cloudflared tunnel list`
3. Restart tunnel if connection drops

### Data Loading Issues
1. Check R2 bucket permissions
2. Verify parquet files exist in bucket
3. Check network connectivity to R2

## Alternative Setup Options

### Option 1: Local Only (No Tunnel)
- Frontend: `npm run dev`
- API: `python tools/db_viewer_api/main.py`
- Data: Load from local files or R2 directly

### Option 2: Local + Tunnel
- Frontend: `npm run dev`
- API: `python tools/db_viewer_api/main.py`
- Tunnel: `cloudflared tunnel --url http://localhost:8000`
- Use tunnel URL for external access

### Option 3: Production Only
- Frontend: Deployed on Vercel
- API: Cloudflare Workers/Functions
- Data: R2 bucket with public access
- No local servers needed

## Quick Start Commands

```bash
# Start everything locally (Option 1)
npm run dev &
cd tools/db_viewer_api && python main.py &

# Start with tunnel (Option 2)
npm run dev &
cd tools/db_viewer_api && python main.py &
cloudflared tunnel --url http://localhost:8000

# Deploy to production (Option 3)
npm run build
vercel --prod
```

## Configuration Files

- `src/config/api.ts` - API endpoint configuration
- `public/airlines.csv` - Airline data with colors
- `.env.local` - Local environment variables
- `.env.production` - Production environment variables
