---
name: unitravel-conventions
description: Conventions and patterns for the Unitravel fleet cost management app. Use when modifying cost calculations, vehicle analysis, financial data parsing, or Google Sheets API interactions.
---

# Unitravel Conventions

## Google Sheets API Pattern

All API calls go through `src/lib/googleSheetsApi.ts`. The backend is Google Apps Script deployed as a web app.

Sheets used:
- **Vehicles**: Fleet data (plates, coefficients, dates)
- **FinancialData**: PyG imported data (concept, amount, year, documentType)
- **CostClassifications**: Account classification (costCenter, nature, distribution)
- **MonthlyIncome**: Vehicle revenue by month
- **Amortizations**: Vehicle depreciation data

## Date Handling

Always use `yyyyMmDdToDate()` from `src/lib/utils.ts`. It handles:
- DD-MM-YYYY (European with dashes)
- DD/MM/YYYY (European with slashes)
- YYYY-MM-DD (ISO)

Never use `new Date(string)` directly.

## Financial Calculations

When filtering costs by classification:
```typescript
// CORRECT - case insensitive
cost.distribution.toUpperCase() === "GENERAL"
cost.distribution.toUpperCase() === vehicle.licensePlate.toUpperCase()

// WRONG - case sensitive
cost.distribution === "General"
```

## Testing Changes

After modifying code:
1. `npm run build` - must compile without errors
2. `npm run dev` - verify in browser
3. Check cost totals match PyG source data
