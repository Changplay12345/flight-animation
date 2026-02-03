# AI Handoff README — Flight Animation (React + Data Merge)
 
 ## 1) Project Overview
 **Project name:** `flight-animation-react`
 **Root folder:** `e:\Dowload\work\flight-animation-react`
 **Related folders:**
 - `e:\Dowload\work\flight-animation` (Python merge + CSV data)
 **Main entry files:**
 - `e:\Dowload\work\flight-animation-react\src\main.tsx`
 - `e:\Dowload\work\flight-animation-react\src\App.tsx`
 
 React (Vite) web app that animates flight tracks on a Leaflet map. It loads flight track CSV(s) in-browser and shows a tooltip with compact flight key + IAS/HDG + FL climb/descend arrow. Data is enriched by merging CAT062 points with SUR_AIR fields.
 
 ## 2) Tech Stack / Dependencies (from package.json / requirements / etc.)
 From `e:\Dowload\work\flight-animation-react\package.json`:
 
 **Frontend deps**
 - `react`, `react-dom`
 - `leaflet`, `react-leaflet`, `leaflet-rotatedmarker`
 - `papaparse`
 - `zustand`
 - `@tanstack/react-virtual`
 
 **Tooling**
 - Vite (override): `vite: npm:rolldown-vite@7.2.5`
 - TypeScript `~5.9.3`
 - ESLint `^9.39.1` + `typescript-eslint`
 - `@vitejs/plugin-react`
 - `babel-plugin-react-compiler`
 
 **Python (merge scripts & API)**
- Merge scripts: Located in `e:\Dowload\work\flight-animation\` 
- Database API: `tools/db_viewer_api/requirements.txt`:
  ```
  fastapi>=0.109.0
  uvicorn[standard]>=0.27.0
  sqlalchemy[asyncio]>=2.0.25
  asyncpg>=0.29.0
  pandas>=2.2.0
  ```
 
 ## 3) Repo/Folders Layout (key directories and what they contain)
 **`e:\Dowload\work\flight-animation-react\`**
 - `src\App.tsx` — main UI + parsing + interpolation + tooltip
 - `src\main.tsx` — React bootstrap
 - `src\index.css` — global styles incl. loading overlay
 - `src\store\` — Zustand store(s)
 - `src\utils\` — helper utilities
 - `src\types\` — TypeScript types
 - `public\` — static assets (airport/runway CSVs + images)
 
 **`e:\Dowload\work\flight-animation\`**
- `data\` — datasets (inputs/outputs)
- `merge_flights_testing_purpose.py` — authoritative merge script

**`tools\db_viewer_api\`**
- `main.py` — FastAPI server for database operations
- `requirements.txt` — Python dependencies
- `services/` — API service modules
 
 ## 4) How to Run (dev/build/lint/test + URLs/ports)

### Quick Start (Just view flights)
```bash
git clone <repo>
cd flight-animation-react
npm install
npm run dev
```
URL: `http://localhost:5173/`

### Full Setup (with all features)
```bash
# Frontend
npm install
npm run dev

# Optional: Database API (for dataset creation, db viewer)
cd tools/db_viewer_api
pip install -r requirements.txt
python main.py

# Optional: Cloudflare tunnel (for external API access)
npm install -g cloudflared
cloudflared tunnel --url http://localhost:8000
```

### Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Preview: `npm run preview`

Tests: none.
 
 ## 5) Data / Inputs / Outputs (file names, locations, column meanings if relevant)
 **Frontend static inputs (`public`)**
 - `e:\Dowload\work\flight-animation-react\public\Airport.csv`
 - `e:\Dowload\work\flight-animation-react\public\runway.csv`
 - `e:\Dowload\work\flight-animation-react\public\Main-Air.png`
 - `e:\Dowload\work\flight-animation-react\public\Sub-Air.png`
 
 **Merge script (authoritative)**
 Run from `e:\Dowload\work\flight-animation`:
 - `python merge_flights_testing_purpose.py`
 
 Inputs:
 - `e:\Dowload\work\flight-animation\data\cat062_all_flights_with_info.csv`
 - `e:\Dowload\work\flight-animation\data\sur_air_20240727.csv`
 
 Output:
 - `e:\Dowload\work\flight-animation\data\Testing purpose air1.csv`
 
 Merge keys:
 - `flight_key` + `timestamp_utc`
 
 Added fields (meaning):
 - `ias_dap`: indicated airspeed (knots)
 - `mag_heading_dap`: magnetic heading (degrees 0–360)
 - `rate_cd`: rate of climb/descent (positive=climb, negative=descend, 0/null=level/unknown)
 
 SUR_AIR columns used (0-based indices; read with `header=None`):
 - `timestamp_utc` = col 3
 - `ias_dap` = col 31
 - `mag_heading_dap` = col 32
 - `rate_cd` = col 33
 - `flight_key` = col 41
 - also reads col 6 for `acid` (not used in merge output)
 
 Expected output behavior:
 - Output row count should match CAT062 row count (left join).
 - Output size should not explode.
 
 ## 6) Key Features (short bullets)
- Leaflet-based flight animation
- Rotated markers (`leaflet-rotatedmarker`)
- In-browser CSV parsing (`papaparse`)
- Tooltip: shortened flight key + IAS/HDG + FL climb/descend arrow
- Loading overlay stays above UI during parsing
- **NEW:** Airline filtering with color coding
- **NEW:** Flight type filtering (inbound/outbound/domestic/overfly)
- **NEW:** Route and airport focus filters
- **NEW:** Database viewer for flight features
- **NEW:** Dataset creation and management
 
 ## 7) What We Changed (exact files + what changed + why)
 **Frontend**
 - `e:\Dowload\work\flight-animation-react\src\App.tsx`
   - Shorten tooltip flight name: `displayKey` truncates `flight_key` if > 12 chars.
   - Tooltip shows IAS + HDG.
   - FL shows climb/descend arrow based on `rateCD`.
   - Fix rate selection: prefer non-zero `rateCD` from either adjacent point.
     - `let rateCD = points[i].rateCD;`
     - `if (rateCD === 0 || rateCD == null) rateCD = points[i + 1].rateCD;`
   - Removed unused `formatCoord`.
 - `e:\Dowload\work\flight-animation-react\src\index.css`
   - Fix loading overlay layering: `#loading { z-index: 10000; }`
 
 **Data script**
 - `e:\Dowload\work\flight-animation\merge_flights_testing_purpose.py`
   - Deduplicate SUR_AIR before merge on (`flight_key`, `timestamp_utc`) to prevent cartesian join explosion.
   - Append `ias_dap`, `mag_heading_dap`, `rate_cd` to CAT062 output.
 
 ## 8) Bugs Found & Fixes (symptom -> root cause -> fix)
 - Failed merge (huge output) -> multiple SUR_AIR matches per key -> dedupe SUR_AIR on (`flight_key`, `timestamp_utc`) before merge.
 - Wrong climb/descend arrow -> `rate_cd` can be 0/null at one endpoint -> prefer non-zero neighbor for interpolation/display.
 - Loading overlay hidden -> z-index conflict -> set `#loading` z-index to 10000.
 
 ## 9) Known Gotchas (platform quirks, scripts, edge cases)
 - PowerShell has no `head`; use `Get-Content <file> | Select-Object -First N`.
 - `rate_cd` frequently 0/null; do not treat missing/zero as authoritative.
 - Removing SUR_AIR dedupe can reintroduce cartesian explosion.
 - SUR_AIR is read with `header=None`; column indices must match the file.
 
 ## 10) Current Status + Next Steps (what's done, what's pending)
**Done**
- Tooltip key shortened
- IAS/HDG displayed
- Climb/descend arrow fixed
- Loading overlay visible
- Merge output stabilized
- Airline filtering system implemented
- Flight type filtering added
- Modern button styling applied
- Auto-detect localhost API for local dev
- Compact UI design implemented
 
 ## 11) Required CSV Columns for Flight Animation

**Core Required Columns (minimum):**
- `flight_key` - Unique flight identifier
- `timestamp_utc` - UTC timestamp (ISO format or parseable)
- `latitude` - Latitude in decimal degrees
- `longitude` - Longitude in decimal degrees

**Optional but Recommended Columns:**
- `flight_level` OR `measured_fl` - Flight level (altitude)
- `actype` - Aircraft type
- `dep` - Departure airport
- `dest` - Destination airport
- `acid` - Aircraft identifier (alternative to flight_key)

**Enhanced Flight Data Columns (from SUR_AIR merge):**
- `ias_dap` - Indicated Airspeed (knots)
- `mag_heading_dap` - Magnetic Heading (degrees 0-360)
- `rate_cd` - Rate of Climb/Descent (positive=climb, negative=descend)
- `vert` - Vertical speed (alternative to rate_cd)

**Column Aliases Supported:**
- Time: `timestamp_utc` OR `time_of_track`
- Altitude: `flight_level` OR `measured_fl`

**Data Format Notes:**
- All numeric columns should be parseable as numbers
- Timestamp should be ISO format or JavaScript Date.parse() compatible
- Empty/null values are handled gracefully
- Missing optional columns will not break the app, just reduce functionality

## 12) Environment Configuration

The app automatically detects local vs production environment:
- **Local dev** (localhost) → Uses `http://localhost:8000` for API
- **Production** → Uses Cloudflare tunnel URL

No `.env` file required - configuration is built-in!

## 13) Project Setup for New Contributors

### What You Need to Install
**Required:**
- Node.js (v16+) - `npm install -g node`
- Git

**Optional (for full features):**
- Python 3.8+ - for db_viewer_api
- pip - Python package manager
- cloudflared - for tunnel access: `npm install -g cloudflared`

### What Works Out of the Box
- ✅ View flight animations
- ✅ Load data from R2 bucket
- ✅ All filtering and UI features
- ✅ No configuration needed

### What Requires Additional Setup
- 📊 Database Viewer & Dataset Creation → Python API server
- 🌐 External API Access → Cloudflare tunnel
- 📁 Local Data Processing → Python merge scripts

### Troubleshooting
- **API not working?** → Start `python tools/db_viewer_api/main.py`
- **Can't create datasets?** → Run `cloudflared tunnel --url http://localhost:8000`
- **Data not loading?** → Check network connection to R2 bucket
