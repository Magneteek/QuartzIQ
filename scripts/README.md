# Utility Scripts

This directory contains standalone utility scripts for development and maintenance tasks.

## Status

⚠️ **Note:** Many of these scripts are legacy utilities that may require updates to work with the current codebase.

## Known Issues

Several scripts reference `./src/lib/extractor.js` which:
1. No longer exists (replaced by TypeScript version)
2. Would have incorrect relative paths (scripts are in `/scripts/` now)

**Scripts needing updates:**
- `import-apify-and-extract-reviews.js` - requires path fix and extractor update
- `resume-review-extraction.js` - requires path fix and extractor update

## Recommendation

For new utility scripts:
- Use TypeScript with proper module resolution
- Import from `@/lib/*` using the same path aliases as the main app
- Use the logging utility at `@/lib/logger` instead of console.log

## Active Scripts

Check the modification dates to see which scripts are actively maintained:
```bash
ls -lht *.js | head -10
```
