# Business Review Extraction Frontend

A modern Next.js frontend application for the universal business review extraction system, featuring real-time extraction progress, advanced filtering, and multiple export formats.

## Features

### 🔍 Advanced Search Parameters
- **Business Categories**: Restaurants, hotels, dental practices, retail stores, and custom categories
- **Location Filtering**: Search by city, region, or country
- **Rating Filters**: Filter by business rating (≤ 4.6 stars) and review rating (≤ 3 stars)
- **Time Range**: Extract reviews from last 7, 14, 30, 60, or 90 days
- **Advanced Options**: Business limits, review limits, minimum reviews per business

### 📊 Real-time Results Display
- **Dual View Modes**: Toggle between table view and card-based list view
- **Live Progress**: Real-time extraction progress with step-by-step updates
- **Smart Filtering**: Filter results by rating, business, or custom criteria
- **Pagination**: Handle large datasets with intelligent pagination

### 📁 Export Capabilities
- **Multiple Formats**: Export to JSON, CSV, or Excel (XLSX)
- **Custom Field Selection**: Choose which data fields to include
- **Progress Tracking**: Real-time export progress indicators
- **Automatic Downloads**: Files download automatically when ready

### 🎨 Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode Support**: Built-in dark/light theme support
- **Intuitive Interface**: Clean, professional design using ShadCN UI
- **Accessibility**: WCAG compliant with keyboard navigation support

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS for responsive design
- **UI Components**: ShadCN UI for consistent design system
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React for modern iconography
- **Export**: XLSX library for Excel export functionality

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Access to the universal-business-review-extractor.js backend

### Installation Steps

1. **Navigate to the project**:
```bash
cd /Users/kris/CLAUDEtools/ORCHESTRAI/review-extraction-frontend
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment variables** in `.env.local`:
```env
# Apify API Configuration
APIFY_API_TOKEN=your_apify_api_token_here

# Backend Configuration
BACKEND_EXTRACTOR_PATH=/Users/kris/CLAUDEtools/ORCHESTRAI/universal-business-review-extractor.js

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Start the development server**:
```bash
npm run dev
```

5. **Open your browser** and visit `http://localhost:3000`

## Usage Guide

### Basic Search
1. **Select Business Category**: Choose from predefined categories or enter custom
2. **Enter Location**: Specify city, region, or country to search
3. **Set Rating Filters**: Configure maximum business rating and review stars
4. **Choose Time Range**: Select how far back to search for reviews
5. **Start Extraction**: Click "Start Extraction" to begin the process

### Advanced Options
- **Business Limit**: Maximum number of businesses to analyze (1-50)
- **Review Limit**: Total number of reviews to extract (1-500)
- **Minimum Reviews**: Businesses must have at least this many reviews
- **Max Reviews per Business**: Limit reviews analyzed per business
- **Text Length Filter**: Minimum character count for review text

### Viewing Results
- **Table View**: Compact, sortable table with all review data
- **List View**: Card-based layout with detailed review information
- **Filtering**: Filter by rating stars, specific businesses, or custom criteria
- **Sorting**: Sort by date, rating, or business name

### Exporting Data
1. **Click Export Button** after extraction completes
2. **Choose Format**: Select JSON, CSV, or Excel
3. **Select Fields**: Choose which data columns to include
4. **Export**: Download starts automatically

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── extract/route.ts          # Extraction API endpoint
│   │   └── export/route.ts           # Export API endpoint
│   ├── globals.css                   # Global styles
│   └── page.tsx                      # Main dashboard page
├── components/
│   ├── dashboard/
│   │   └── review-extraction-dashboard.tsx
│   ├── forms/
│   │   └── search-form.tsx           # Main search form
│   ├── results/
│   │   ├── results-table.tsx         # Table view component
│   │   ├── results-list.tsx          # List view component
│   │   └── extraction-progress.tsx   # Progress indicator
│   ├── cards/
│   │   ├── business-card.tsx         # Business info card
│   │   └── review-card.tsx           # Review display card
│   ├── modals/
│   │   └── export-modal.tsx          # Export configuration modal
│   └── ui/                           # ShadCN UI components
└── lib/
    └── utils.ts                      # Utility functions
```

## Development

### Available Scripts
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

This project is part of the ORCHESTRAI system and follows the same licensing terms.