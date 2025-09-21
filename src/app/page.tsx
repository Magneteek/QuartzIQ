import { EnhancedReviewExtractionDashboard } from '@/components/dashboard/enhanced-review-extraction-dashboard'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="relative">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-16" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent" />

        {/* Main Content */}
        <div className="relative z-10">
          <EnhancedReviewExtractionDashboard />
        </div>
      </div>
    </main>
  )
}
