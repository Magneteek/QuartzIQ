# REVIEW EXTRACTION FRONTEND - PROJECT MEMORY

## CRITICAL CONFIGURATION

### PORT CONFIGURATION - ABSOLUTE REQUIREMENT
**MANDATORY PORT: 3069**

- NEVER use any other port for this project
- Development server MUST run on port 3069
- No exceptions, no variations, no alternatives
- Command: `PORT=3069 npm run dev`

### Project Structure
```
/review-extraction-frontend/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── review-extraction-dashboard.tsx
│   │   │   └── enhanced-review-extraction-dashboard.tsx
│   │   ├── forms/
│   │   ├── results/
│   │   ├── modals/
│   │   └── history/
│   ├── app/
│   └── lib/
├── package.json
├── next.config.ts
└── CLAUDE.md (this file)
```

### Key Features
- Contact extraction from business websites
- Firecrawl API integration for web scraping
- Real-time progress tracking with streaming responses
- Contact enrichment pipeline
- Historical vault system for data persistence
- Multiple view modes (cards, table, list)
- Export functionality

### Backend Integration
- Comprehensive hotel contact extractor: `/comprehensive-hotel-contact-extractor.js`
- Working hotel extractor: `/working-hotel-extractor.js`
- API endpoints for extraction and enrichment

### Technology Stack
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- ShadCN UI components
- Framer Motion for animations
- Firecrawl API for web scraping

### Development Commands
```bash
# Install dependencies
npm install

# Start development server (MANDATORY PORT 3069)
PORT=3069 npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

### API Configuration
- Firecrawl API key required in .env.local
- Google Places API for contact enrichment
- DataForSEO API for business data

### Recent Updates
- Enhanced dashboard with modern UI
- Real-time streaming for extraction progress
- Contact enrichment with external APIs
- Vault system for extraction history
- Multiple extraction methods for reliability

## DEPLOYMENT NOTES
- Ensure PORT=3069 in all deployment configurations
- Verify all API keys are properly configured
- Test Firecrawl extraction methods after deployment

## TROUBLESHOOTING
- If API errors occur, check streaming response handling
- Verify tool_use/tool_result flow in real-time updates
- Check console for Firecrawl API quota limits