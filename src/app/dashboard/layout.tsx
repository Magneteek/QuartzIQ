'use client'

import { Navbar } from '@/components/layout/navbar'
import { SettingsModal } from '@/components/modals/settings-modal'
import { useState, useEffect } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
        {children}
      </main>
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  )
}
