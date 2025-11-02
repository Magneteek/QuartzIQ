/**
 * Custom hook for dashboard UI state management
 *
 * Manages all UI-related state (view modes, modals, selections, etc.)
 * separate from business logic.
 */

import { useState, useEffect } from 'react'

export function useDashboardUI() {
  // View mode state (with localStorage persistence)
  const [viewMode, setViewMode] = useState<'table' | 'list' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('quartziq-view-mode') as 'table' | 'list' | 'cards' || 'cards'
    }
    return 'cards'
  })

  // Modal state
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showLeadSelectionModal, setShowLeadSelectionModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Selection state
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set())
  const [selectedBusinesses, setSelectedBusinesses] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // UI preferences
  const [darkMode, setDarkMode] = useState(true)
  const [qualitySortOrder, setQualitySortOrder] = useState<'desc' | 'asc' | 'none'>('desc')
  const [showQualityLegend, setShowQualityLegend] = useState(false)
  const [showNewOnly, setShowNewOnly] = useState(false)

  // Client configuration
  const [selectedClientId, setSelectedClientId] = useState<string>('default')

  // History refresh trigger
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)

  // Business scraped status (for deduplication)
  const [businessScrapedStatus, setBusinessScrapedStatus] = useState<Record<string, boolean>>({})

  // Persist view mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('quartziq-view-mode', viewMode)
    }
  }, [viewMode])

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  /**
   * Toggle view mode with consistency check
   */
  const changeViewMode = (newMode: 'table' | 'list' | 'cards') => {
    setViewMode(newMode)
  }

  /**
   * Toggle dark mode
   */
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev)
  }

  /**
   * Reset selections
   */
  const resetSelections = () => {
    setSelectedReviews(new Set())
    setSelectedBusinesses(new Set())
    setSelectAll(false)
  }

  /**
   * Toggle select all
   */
  const toggleSelectAll = (allIds: string[]) => {
    if (selectAll) {
      resetSelections()
    } else {
      setSelectedReviews(new Set(allIds))
      setSelectAll(true)
    }
  }

  /**
   * Toggle single review selection
   */
  const toggleReviewSelection = (id: string) => {
    setSelectedReviews(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  /**
   * Toggle business selection
   */
  const toggleBusinessSelection = (id: string) => {
    setSelectedBusinesses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  /**
   * Cycle through quality sort orders
   */
  const cycleQualitySort = () => {
    setQualitySortOrder(prev => {
      if (prev === 'desc') return 'asc'
      if (prev === 'asc') return 'none'
      return 'desc'
    })
  }

  /**
   * Trigger history refresh
   */
  const refreshHistory = () => {
    setHistoryRefreshTrigger(prev => prev + 1)
  }

  return {
    // View state
    viewMode,
    changeViewMode,
    darkMode,
    toggleDarkMode,

    // Modal state
    showExportModal,
    setShowExportModal,
    showSettingsModal,
    setShowSettingsModal,
    showLeadSelectionModal,
    setShowLeadSelectionModal,
    showConfirmationModal,
    setShowConfirmationModal,
    showHistory,
    setShowHistory,

    // Selection state
    selectedReviews,
    selectedBusinesses,
    selectAll,
    toggleSelectAll,
    toggleReviewSelection,
    toggleBusinessSelection,
    resetSelections,

    // UI preferences
    qualitySortOrder,
    cycleQualitySort,
    showQualityLegend,
    setShowQualityLegend,
    showNewOnly,
    setShowNewOnly,

    // Client config
    selectedClientId,
    setSelectedClientId,

    // History
    historyRefreshTrigger,
    refreshHistory,

    // Deduplication
    businessScrapedStatus,
    setBusinessScrapedStatus
  }
}
