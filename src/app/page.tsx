'use client'

import { EnhancedReviewExtractionDashboard } from '@/components/dashboard/enhanced-review-extraction-dashboard'
import { Navbar } from '@/components/layout/navbar'
import { SettingsModal } from '@/components/modals/settings-modal'
import { useState, useEffect } from 'react'

export default function Home() {
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  useEffect(() => {
    const handleOpenSettings = () => setShowSettingsModal(true)
    window.addEventListener('openSettings', handleOpenSettings)
    return () => window.removeEventListener('openSettings', handleOpenSettings)
  }, [])

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <EnhancedReviewExtractionDashboard />
      </main>
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  )
}
