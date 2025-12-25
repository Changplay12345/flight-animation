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
 
 **Python (merge scripts)**
 - Located in `e:\Dowload\work\flight-animation\` (no pinned `requirements.txt` confirmed in this snapshot).
 
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
 
 ## 4) How to Run (dev/build/lint/test + URLs/ports)
 From `e:\Dowload\work\flight-animation-react`:
 - Dev: `npm run dev`
 - Build: `npm run build`
 - Lint: `npm run lint`
 - Preview: `npm run preview`
 
 URL (dev): `http://localhost:5173/`
 
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
 
 ## 10) Current Status + Next Steps (what’s done, what’s pending)
 **Done**
 - Tooltip key shortened
 - IAS/HDG displayed
 - Climb/descend arrow fixed
 - Loading overlay visible
 - Merge output stabilized
 
 **Next steps**
 - Document required CAT062 columns expected by `src\App.tsx` parser.
 - Add merge-time assertion: merged row count == CAT062 row count.
