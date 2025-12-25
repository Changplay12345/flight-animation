# AI Handoff: Flight Animation (React + Data Merge)

## Purpose
This file is meant to transfer project context to another AI profile so it can immediately continue work without re-discovering what was done.

---

## User Rules / Constraints (must follow)
- All responses must be concise.
- Only output code if asked.
- Do not wipe databases or Docker volumes unless explicitly told to.

---

## Repos / Folders Involved
### Frontend (React)
- Path: `e:\Dowload\work\flight-animation-react`
- Tech: Vite + React + TypeScript
- Key deps (from `package.json`):
  - `react`, `react-dom`
  - `leaflet`, `react-leaflet`, `leaflet-rotatedmarker`
  - `papaparse`
  - `zustand`

### Data + Python Scripts
- Path: `e:\Dowload\work\flight-animation`
- Contains:
  - `data\cat062_all_flights_with_info.csv`
  - `data\sur_air_20240727.csv`
  - merge scripts (not all are authoritative; see below)

---

## What the user wanted
- Minimize/shorten flight name shown in the tooltip (too long / intrusive).
- Include extra SUR_AIR fields in merged dataset:
  - `ias_dap` (IAS)
  - `mag_heading_dap` (HDG)
  - `rate_cd` (rate of climb/descent)
- Show IAS + HDG in tooltip.
- Show climb/descend arrow next to FL based on `rate_cd`.
- Loading overlay must show during file parsing (must be visible on top).
- Fix merge output being far larger than expected (cartesian join explosion).
- Fix incorrect arrow direction when FL trend indicates opposite.

---

## Data meaning (fields)
- `ias_dap`: indicated airspeed (knots).
- `mag_heading_dap`: magnetic heading (degrees 0-360).
- `rate_cd`: rate of climb/descent (positive = climb, negative = descend, 0/null = level/unknown).

---

## Key Implementation Changes (authoritative)

### 1) Tooltip flight name shortening
- File: `e:\Dowload\work\flight-animation-react\src\App.tsx`
- Change: tooltip title uses a shortened `displayKey` derived from `flight_key`.
- Behavior: if key length > 12, show first 12 chars + `...`.

Snippet location (approx): near `FlightTooltip` state selection
- `displayKey = rawKey ? rawKey.length > 12 ? rawKey.substring(0, 12) + '...' : rawKey : ''`

### 2) IAS + HDG + rateCD shown in tooltip
- File: `e:\Dowload\work\flight-animation-react\src\App.tsx`
- Tooltip renders:
  - IAS from `ias` / `ias_dap` mapping in parsed points
  - HDG from `magHeading` / `mag_heading_dap` mapping
  - FL row shows arrow if `rateCD != null && rateCD !== 0`:
    - `rateCD > 0` => up arrow
    - `rateCD < 0` => down arrow

### 3) Fix: climb/descend arrow was wrong (rate_cd selection)
Problem observed:
- Sometimes FL is decreasing but arrow showed climb.

Root cause:
- Rate of climb/descent is “event-like” and can be present at one endpoint but be 0/null at the other.
- Interpolation was effectively picking a 0/null from one point, losing the meaningful sign.

Fix applied:
- In both `interpolatePosition` AND tooltip’s `currentPosForDisplay` computation, choose a non-zero `rateCD` from either adjacent point (prefer non-zero).

Logic used:
- `let rateCD = points[i].rateCD;`
- `if (rateCD === 0 || rateCD == null) rateCD = points[i + 1].rateCD;`

Files/areas:
- `e:\Dowload\work\flight-animation-react\src\App.tsx`
  - `interpolatePosition(...)`
  - `FlightTooltip` `useMemo` that computes `currentPosForDisplay`

### 4) Fix: loading overlay missing / behind other UI
- File: `e:\Dowload\work\flight-animation-react\src\index.css`
- Cause: `#loading` and `#file-picker` had same z-index.
- Fix: set `#loading { z-index: 10000; }` so it is above file picker.

### 5) Fix: merged CSV was massively larger than expected
Observed:
- Output CSV ballooned (GBs), row count far above CAT062 row count.

Root cause:
- Merge became a cartesian product due to multiple matches per (`flight_key`, `timestamp_utc`) in SUR_AIR.

Fix applied:
- Deduplicate SUR_AIR on keys before merge:
  - `drop_duplicates(subset=['flight_key', 'timestamp_utc'], keep='first')`

Authoritative script:
- File: `e:\Dowload\work\flight-animation\merge_flights_testing_purpose.py`
- Output:
  - `data\Testing purpose air1.csv`
- Merge keys:
  - `flight_key` + `timestamp_utc`
- Output columns:
  - preserves CAT062 column order
  - appends `ias_dap`, `mag_heading_dap`, `rate_cd` at the end

SUR_AIR columns used (0-based column indices in that file):
- `timestamp_utc` = col 3
- `ias_dap` = col 31
- `mag_heading_dap` = col 32
- `rate_cd` = col 33
- `flight_key` = col 41

Implementation detail:
- SUR_AIR is read with `header=None` and `usecols=[3, 6, 31, 32, 33, 41]` (acid included but not used in merge output).

### 6) Cleanup: remove unused code
- File: `e:\Dowload\work\flight-animation-react\src\App.tsx`
- Removed unused `formatCoord` function (was for lat/lon formatting but tooltip no longer shows coordinates).

---

## How to run the frontend
From `e:\Dowload\work\flight-animation-react`:
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Preview: `npm run preview`

App URL used during work:
- `http://localhost:5173/`

---

## How to generate the merged CSV
From `e:\Dowload\work\flight-animation`:
- Run: `python merge_flights_testing_purpose.py`

Inputs:
- `data\cat062_all_flights_with_info.csv`
- `data\sur_air_20240727.csv`

Output:
- `data\Testing purpose air1.csv`

Expected behavior:
- Output row count should match CAT062 row count (left join).
- File size should increase moderately (3 extra columns), not explode.

---

## File Paths That Were Edited
Frontend:
- `e:\Dowload\work\flight-animation-react\src\App.tsx`
  - shorten tooltip title (`displayKey`)
  - show IAS/HDG/rateCD
  - fix rateCD selection logic (prefer non-zero)
  - remove unused `formatCoord`
- `e:\Dowload\work\flight-animation-react\src\index.css`
  - `#loading` z-index increased to `10000`

Data script:
- `e:\Dowload\work\flight-animation\merge_flights_testing_purpose.py`
  - dedupe SUR_AIR before merge
  - add 3 columns to CAT062 output

---

## Known Gotchas
- PowerShell does not have `head` by default; use `Get-Content ... | Select-Object -First N`.
- `rate_cd` can be 0/null frequently; do not treat missing/zero as authoritative for arrow direction.
- Merging without dedupe on SUR_AIR (`flight_key`, `timestamp_utc`) can create a cartesian join and massively inflate output size.

---

## Status
- All previously listed tasks are completed:
  - tooltip key shortened
  - IAS/HDG displayed
  - climb/descend arrow fixed
  - loading overlay visible
  - merge output stabilized (no explosion)
  - lint cleanup (unused function removed)
