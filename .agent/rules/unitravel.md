# Unitravel - Project Rules

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend/DB**: Google Sheets via Google Apps Script API (no traditional database)
- **Routing**: HashRouter (required for GitHub Pages compatibility)
- **Deploy**: GitHub Pages via GitHub Actions

## Data Conventions
- All financial amounts are in EUROS (€)
- Dates must support European format DD-MM-YYYY and DD/MM/YYYY (see `yyyyMmDdToDate` in `src/lib/utils.ts`)
- String comparisons for vehicle plates and cost classifications MUST be case-insensitive (use `.toUpperCase()` or `.toLowerCase()`)
- Cost distribution values can be "GENERAL" (distributed by coefficient) or a specific license plate (direct imputation)

## Cost Distribution Logic
- **Direct Fixed Costs (CD Fij)**: Distributed by time coefficient (coefTime)
- **Direct Variable Costs (CD Var)**: Distributed by kilometer coefficient (coefKm)
- **Indirect Fixed Costs (CI Fij)**: Distributed by time coefficient
- **Indirect Variable Costs (CI Var)**: Distributed by kilometer coefficient
- Costs with distribution matching a license plate are imputed directly to that vehicle

## Important Notes
- Financial data comes from PyG (Profit & Loss) imported via PDF with AI parsing
- Income accounts start with "7" in the Spanish accounting system
- The `_redirects` file in `/public` is for Netlify fallback compatibility (keep it)
- Never divide financial amounts by 100 - data arrives already in euros

## Code Style
- Use TypeScript strict mode
- Components in `src/components/`, pages in `src/pages/`
- API layer in `src/lib/googleSheetsApi.ts`
- Utility functions in `src/lib/utils.ts`
- Spanish UI labels, English code/comments
