'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { EnhancedSearchForm } from '@/components/forms/enhanced-search-form'
import { EnhancedHistorySidebar } from '@/components/history/enhanced-history-sidebar'
import { EnhancedExtractionProgress } from '@/components/results/enhanced-extraction-progress'
import { EnhancedBusinessCard } from '@/components/cards/enhanced-business-card'
import { ResultsTable } from '@/components/results/results-table'
import { ResultsList } from '@/components/results/results-list'
import { ExportModal } from '@/components/modals/export-modal'
import { SettingsModal } from '@/components/modals/settings-modal'
import { LeadSelectionModal } from '@/components/modals/lead-selection-modal'
import { ClientSelector } from '@/components/client-config/client-selector'
import {
  Database,
  Download,
  List,
  Table,
  Users,
  Phone,
  History,
  Sparkles,
  TrendingUp,
  BarChart3,
  Settings,
  Moon,
  Sun,
  Zap,
  Search,
  Gem,
  Target,
  Star,
  Building,
  MessageSquare,
  Mail,
  Globe,
  Trash2,
  MapPin,
  Calendar,
  Grid3X3,
  ExternalLink,
  Award,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchCriteria {
  [key: string]: unknown
  category: string
  location: string
  minRating?: number
  maxStars: number
  dayLimit: number
  businessLimit: number
  language: string
  countryCode: string
}

interface Business {
  [key: string]: unknown
  title: string
  address: string
  totalScore: number
  reviewsCount: number
  url: string
  placeId: string
  phone?: string
  website?: string
  email?: string
  socialMedia?: {
    facebook?: string
    linkedin?: string
    twitter?: string
    instagram?: string
  }
  contactEnriched?: boolean
  enrichmentDate?: Date
}

interface Review {
  title: string
  address: string
  name: string
  stars: number
  publishedAtDate: string
  text: string
  reviewerNumberOfReviews: number
  isLocalGuide: boolean
  originalLanguage: string
  reviewUrl: string
  reviewerUrl: string
  url: string
}

interface ExtractionResult {
  businesses: Record<string, unknown>[]
  reviews: Record<string, unknown>[]
  searchCriteria: Record<string, unknown>
  extractionDate: Date
}

export function EnhancedReviewExtractionDashboard() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [results, setResults] = useState<ExtractionResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'list' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('quartziq-view-mode') as 'table' | 'list' | 'cards' || 'cards'
    }
    return 'cards'
  })
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showLeadSelectionModal, setShowLeadSelectionModal] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [qualitySortOrder, setQualitySortOrder] = useState<'desc' | 'asc' | 'none'>('desc')
  const [showQualityLegend, setShowQualityLegend] = useState(false)

  // Request cleanup ref
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // Contact enrichment state
  const [isEnrichingContacts, setIsEnrichingContacts] = useState(false)
  const [enrichmentProgress, setEnrichmentProgress] = useState(0)
  const [enrichmentStep, setEnrichmentStep] = useState('')

  // Review selection state
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set())
  const [selectedBusinesses, setSelectedBusinesses] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // History state
  const [showHistory, setShowHistory] = useState(false)
  const [currentExtractionId, setCurrentExtractionId] = useState<string | null>(null)
  const [lastSearchCriteria, setLastSearchCriteria] = useState<SearchCriteria | null>(null)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)

  // Client configuration state
  const [selectedClientId, setSelectedClientId] = useState<string>('default')

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Debug viewMode changes and save to localStorage
  useEffect(() => {
    console.log('ViewMode changed to:', viewMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('quartziq-view-mode', viewMode)
    }
  }, [viewMode])

  // Create a wrapper function for setViewMode to ensure consistency
  const changeViewMode = (newMode: 'table' | 'list' | 'cards') => {
    console.log('changeViewMode called with:', newMode, 'current viewMode:', viewMode)
    setViewMode(newMode)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleSearch = async (criteria: SearchCriteria) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    setIsExtracting(true)
    setProgress(0)
    setCurrentStep('Initializing AI extraction engine...')
    setLastSearchCriteria(criteria)
    const extractionStartTime = Date.now()

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(criteria),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Extraction failed')
      }

      let finalResult: ExtractionResult | null = null

      // Handle streaming response for real-time updates
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          const lines = text.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.type === 'progress') {
                setProgress(data.progress)
                setCurrentStep(data.step)
              } else if (data.type === 'result') {
                finalResult = data.result
                setResults(finalResult)
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }

      // Auto-save extraction to history
      if (finalResult) {
        try {
          const extractionTime = Date.now() - extractionStartTime
          const saveResponse = await fetch('/api/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'save',
              data: {
                searchCriteria: criteria,
                results: finalResult,
                extractionTime
              }
            }),
          })

          if (saveResponse.ok) {
            const saveData = await saveResponse.json()
            if (saveData.success) {
              setCurrentExtractionId(saveData.data.id)
              console.log(`📚 Extraction automatically saved to vault: ${saveData.data.id}`)
            } else {
              console.error('❌ History save failed:', saveData.error || 'Unknown error')
              setCurrentStep(`⚠️ Extraction complete but history save failed: ${saveData.error || 'Unknown error'}`)
            }
          } else {
            const errorData = await saveResponse.json().catch(() => ({}))
            console.error('❌ History save request failed:', saveResponse.status, errorData)
            setCurrentStep(`⚠️ Extraction complete but history save failed: ${saveResponse.status}`)
          }
        } catch (error) {
          console.error('❌ Failed to save extraction to history:', error)
          setCurrentStep(`⚠️ Extraction complete but history save failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setCurrentStep('Extraction cancelled')
      } else {
        console.error('Extraction error:', error)
        setCurrentStep('Extraction failed - please try again')
      }
    } finally {
      setIsExtracting(false)
      abortControllerRef.current = null
    }
  }

  const handleContactEnrichment = async (includeApifyEnrichment = false, includeLinkedInEnrichment = false) => {
    if (!qualifyingBusinesses.length || selectedBusinesses.size === 0) {
      alert('Please select at least one business for contact enrichment.')
      return
    }

    const businessesToEnrich = qualifyingBusinesses.filter((business: any, index) =>
      selectedBusinesses.has(index.toString())
    )

    setIsEnrichingContacts(true)
    setEnrichmentProgress(0)
    setEnrichmentStep(`Enriching ${businessesToEnrich.length} selected businesses...`)

    try {
      const response = await fetch('/api/enrich-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businesses: businessesToEnrich,
          extractionId: currentExtractionId,
          options: {
            includeGooglePlaces: true,
            includeApifyEnrichment,
            includeLinkedInEnrichment,
            maxConcurrent: 3
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Contact enrichment failed')
      }

      // Handle streaming response for real-time updates
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          const lines = text.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.type === 'progress') {
                setEnrichmentProgress(data.progress)
                setEnrichmentStep(data.step)
              } else if (data.type === 'result') {
                setResults(prev => prev ? {
                  ...prev,
                  businesses: data.businesses
                } : null)

                if (currentExtractionId) {
                  try {
                    await fetch('/api/history', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        action: 'updateEnrichment',
                        data: {
                          id: currentExtractionId,
                          enrichedBusinesses: data.businesses,
                          enrichmentStats: data.enrichmentStats
                        }
                      }),
                    })
                  } catch (error) {
                    console.warn('Failed to update enrichment in history:', error)
                  }
                }
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Contact enrichment error:', error)
      setEnrichmentStep('Contact enrichment failed')
    } finally {
      setIsEnrichingContacts(false)

      // Trigger Contact Vault refresh to show updated green icons
      console.log('🔄 Triggering Contact Vault refresh after enrichment...')
      setHistoryRefreshTrigger(prev => prev + 1)

      // Refresh data from history to ensure enriched data is displayed
      if (currentExtractionId) {
        setTimeout(async () => {
          try {
            console.log('🔄 Refreshing data after enrichment completion...')
            await handleLoadExtraction(currentExtractionId)
          } catch (error) {
            console.error('Failed to refresh data after enrichment:', error)
          }
        }, 1000) // Small delay to ensure history is updated
      }
    }
  }

  // LinkedIn Executive Email Enrichment
  const handleLinkedInEnrichment = async () => {
    if (!qualifyingBusinesses.length || selectedBusinesses.size === 0) {
      alert('Please select at least one business for LinkedIn executive email enrichment.')
      return
    }

    const businessesToEnrich = qualifyingBusinesses.filter((business: any, index) =>
      selectedBusinesses.has(index.toString())
    )

    setIsEnrichingContacts(true)
    setEnrichmentProgress(0)
    setEnrichmentStep(`🔗 Finding LinkedIn executives for ${businessesToEnrich.length} businesses...`)

    try {
      const response = await fetch('/api/linkedin-enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businesses: businessesToEnrich,
          options: {
            maxBusinesses: businessesToEnrich.length,
            includePhones: true,
            prioritizeEmails: true
          }
        }),
      })

      if (!response.ok) {
        throw new Error('LinkedIn enrichment failed')
      }

      // Handle streaming response for real-time updates
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          const lines = text.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.type === 'progress') {
                setEnrichmentProgress(data.progress)
                setEnrichmentStep(data.step)
              } else if (data.type === 'result') {
                // Update results with enriched businesses
                setResults(prev => prev ? {
                  ...prev,
                  businesses: data.result.enrichedBusinesses,
                  linkedinEnrichmentSummary: data.result.enrichmentSummary
                } : null)

                setEnrichmentStep(`✅ LinkedIn enrichment complete! Found ${data.result.newEmailsFound} new executive emails`)
              } else if (data.type === 'error') {
                throw new Error(data.error)
              }
            } catch (parseError) {
              // Ignore malformed JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('LinkedIn enrichment error:', error)
      setEnrichmentStep('LinkedIn enrichment failed - please try again')
    } finally {
      setIsEnrichingContacts(false)

      // Trigger Contact Vault refresh to show updated green icons
      console.log('🔄 Triggering Contact Vault refresh after LinkedIn enrichment...')
      setHistoryRefreshTrigger(prev => prev + 1)
    }
  }

  // Clean up binary garbage email data
  const handleCleanupGarbageEmails = async () => {
    if (!qualifyingBusinesses.length) {
      alert('No business data available for cleanup.')
      return
    }

    const garbageEmails = qualifyingBusinesses.filter((business: any) => {
      if (!business.email) return false
      // Check for binary garbage patterns (same logic as ContactExtractor)
      const nonAsciiChars = business.email.replace(/[\x00-\x7F]/g, '').length
      const binaryRatio = nonAsciiChars / business.email.length
      return binaryRatio > 0.3
    })

    if (garbageEmails.length === 0) {
      alert('No garbage email data found to clean up.')
      return
    }

    const confirmCleanup = confirm(
      `Found ${garbageEmails.length} businesses with garbage email data. ` +
      `This will remove the invalid emails and reset their enrichment status so they can be re-processed. Continue?`
    )

    if (!confirmCleanup) return

    try {
      console.log(`🧹 Cleaning up ${garbageEmails.length} garbage emails...`)

      // Clean up the data locally
      const cleanedBusinesses = results.businesses.map((business: any) => {
        if (business.email) {
          const nonAsciiChars = business.email.replace(/[\x00-\x7F]/g, '').length
          const binaryRatio = nonAsciiChars / business.email.length

          if (binaryRatio > 0.3) {
            console.log(`   🗑️ Removing garbage email from ${business.title}: ${business.email}`)
            const cleaned = { ...business }
            delete cleaned.email
            cleaned.contactEnriched = false
            delete cleaned.enrichmentDate
            return cleaned
          }
        }
        return business
      })

      // Update the results
      setResults(prev => prev ? {
        ...prev,
        businesses: cleanedBusinesses
      } : null)

      // Update the stored extraction if we have an ID
      if (currentExtractionId) {
        try {
          await fetch('/api/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'updateEnrichment',
              data: {
                id: currentExtractionId,
                enrichedBusinesses: cleanedBusinesses,
                enrichmentStats: {
                  garbageEmailsRemoved: garbageEmails.length,
                  cleanupDate: new Date().toISOString()
                }
              }
            }),
          })
          console.log('✅ Updated stored extraction with cleaned data')
        } catch (error) {
          console.warn('Failed to update stored extraction:', error)
        }
      }

      alert(`Successfully cleaned up ${garbageEmails.length} garbage emails. These businesses can now be re-enriched with valid contact data.`)

    } catch (error) {
      console.error('Cleanup error:', error)
      alert('Failed to clean up garbage emails. Please try again.')
    }
  }

  // Business selection handlers
  const handleBusinessSelect = (businessIndex: number, isSelected: boolean) => {
    console.log('handleBusinessSelect called:', { businessIndex, isSelected, currentSize: selectedBusinesses.size })
    const newSelected = new Set(selectedBusinesses)
    if (isSelected) {
      newSelected.add(businessIndex.toString())
      console.log('Adding business', businessIndex, 'new size:', newSelected.size)
    } else {
      newSelected.delete(businessIndex.toString())
      console.log('Removing business', businessIndex, 'new size:', newSelected.size)
    }
    setSelectedBusinesses(newSelected)
  }

  const handleSelectAllBusinesses = (selectAll: boolean) => {
    if (selectAll && qualifyingBusinesses.length > 0) {
      const allBusinessIndices = new Set(qualifyingBusinesses.map((_, index) => index.toString()))
      setSelectedBusinesses(allBusinessIndices)
    } else {
      setSelectedBusinesses(new Set())
    }
    setSelectAll(selectAll)
  }

  // Review selection handlers (for compatibility)
  const handleReviewSelect = (reviewIndex: number, isSelected: boolean) => {
    const newSelected = new Set(selectedReviews)
    if (isSelected) {
      newSelected.add(reviewIndex.toString())
    } else {
      newSelected.delete(reviewIndex.toString())
    }
    setSelectedReviews(newSelected)
  }

  const handleSelectAllReviews = (selectAll: boolean) => {
    if (selectAll && results) {
      const allReviewIndices = new Set(results.reviews.map((_, index) => index.toString()))
      setSelectedReviews(allReviewIndices)
    } else {
      setSelectedReviews(new Set())
    }
    setSelectAll(selectAll)
  }

  // Load extraction from history
  const handleLoadExtraction = async (id: string) => {
    try {
      const response = await fetch(`/api/history/${id}`)
      const data = await response.json()

      if (data.success && data.data) {
        const extraction = data.data
        setResults(extraction.results)
        setCurrentExtractionId(id)
        setLastSearchCriteria(extraction.searchCriteria)
        console.log(`🏦 Loaded extraction from vault: ${id}`)
      } else {
        console.error('Failed to load extraction:', data.error)
      }
    } catch (error) {
      console.error('Error loading extraction:', error)
    }
  }

  // Reset selections when new results arrive
  useEffect(() => {
    setSelectedReviews(new Set())
    setSelectedBusinesses(new Set())
    setSelectAll(false)
  }, [results])

  // Lead Quality Scoring Algorithm
  const calculateLeadQuality = (business: any, businessReviews: any[]) => {
    let score = 0
    let factors = []

    // Factor 1: Removed - Response Rate (not reliable with partial review scraping)

    // Factor 1: Review Volume (0-30 points) - Increased weight
    const reviewCount = business.reviewsCount || businessReviews.length
    let volumeScore = 0
    if (reviewCount >= 100) volumeScore = 30
    else if (reviewCount >= 50) volumeScore = 24
    else if (reviewCount >= 20) volumeScore = 18
    else if (reviewCount >= 10) volumeScore = 12
    else if (reviewCount >= 5) volumeScore = 6
    score += volumeScore
    factors.push(`Review Volume: ${reviewCount} reviews (+${volumeScore}pts)`)

    // Factor 2: Average Rating (0-25 points) - Increased weight
    const rating = business.totalScore || 0
    const ratingScore = Math.round((rating / 5) * 25)
    score += ratingScore
    factors.push(`Rating: ${rating.toFixed(1)}/5 (+${ratingScore}pts)`)

    // Factor 3: Recent Activity (0-20 points) - Increased weight
    const recentReviews = businessReviews.filter(review => {
      const reviewDate = new Date(review.publishedAtDate)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      return reviewDate > sixMonthsAgo
    }).length
    const recentActivityRate = businessReviews.length > 0 ? recentReviews / businessReviews.length : 0
    const activityScore = Math.round(recentActivityRate * 20)
    score += activityScore
    factors.push(`Recent Activity: ${Math.round(recentActivityRate * 100)}% (+${activityScore}pts)`)

    // Factor 4: Review Quality - Average text length (0-25 points) - Increased weight
    const avgTextLength = businessReviews.length > 0
      ? businessReviews.reduce((sum, review) => sum + (review.text?.length || 0), 0) / businessReviews.length
      : 0
    let qualityScore = 0
    if (avgTextLength >= 200) qualityScore = 25
    else if (avgTextLength >= 150) qualityScore = 20
    else if (avgTextLength >= 100) qualityScore = 15
    else if (avgTextLength >= 50) qualityScore = 10
    else if (avgTextLength >= 25) qualityScore = 5
    score += qualityScore
    factors.push(`Review Quality: ${Math.round(avgTextLength)} chars avg (+${qualityScore}pts)`)

    // Determine quality tier
    let tier = 'Bronze'
    let tierColor = 'text-orange-600'
    let tierBg = 'bg-orange-500/20 border-orange-500/30'

    if (score >= 80) {
      tier = 'Platinum'
      tierColor = 'text-purple-400'
      tierBg = 'bg-purple-500/20 border-purple-500/30'
    } else if (score >= 70) {
      tier = 'Gold'
      tierColor = 'text-yellow-400'
      tierBg = 'bg-yellow-500/20 border-yellow-500/30'
    } else if (score >= 60) {
      tier = 'Silver'
      tierColor = 'text-gray-300'
      tierBg = 'bg-gray-500/20 border-gray-500/30'
    }

    return {
      score,
      tier,
      tierColor,
      tierBg,
      factors,
      reviewCount,
      rating: rating.toFixed(1),
      recentActivityRate: Math.round(recentActivityRate * 100),
      avgTextLength: Math.round(avgTextLength)
    }
  }

  // Filter businesses to only show those with qualifying reviews and add quality scores
  const qualifyingBusinesses = React.useMemo(() => {
    if (!results) return []

    // Get unique business titles that have qualifying reviews
    const businessesWithReviews = new Set(results.reviews.map((review: any) => review.title))

    // Filter businesses to only include those with qualifying reviews
    const filteredBusinesses = results.businesses.filter((business: any) =>
      businessesWithReviews.has(business.title)
    )

    // Add quality scores to each business
    const businessesWithQuality = filteredBusinesses.map((business: any) => {
      const businessReviews = results.reviews.filter((review: any) =>
        review.title === business.title
      )
      const qualityData = calculateLeadQuality(business, businessReviews)

      return {
        ...business,
        leadQuality: qualityData,
        reviewsForBusiness: businessReviews
      }
    })

    // Apply sorting based on quality sort order
    if (qualitySortOrder === 'desc') {
      return businessesWithQuality.sort((a, b) => b.leadQuality.score - a.leadQuality.score)
    } else if (qualitySortOrder === 'asc') {
      return businessesWithQuality.sort((a, b) => a.leadQuality.score - b.leadQuality.score)
    } else {
      // 'none' - sort by review count descending as fallback
      return businessesWithQuality.sort((a, b) => b.reviewsCount - a.reviewsCount)
    }
  }, [results, qualitySortOrder])

  // Memoize expensive computations based on qualifying businesses only
  const statsData = React.useMemo(() => {
    if (!results) return null

    let enriched = 0, phoneNumbers = 0, emails = 0, websites = 0, garbageEmails = 0
    let totalRating = 0

    for (const business of qualifyingBusinesses) {
      const b = business as any
      if (b.phone || b.website || b.email) enriched++
      if (b.phone) phoneNumbers++
      if (b.email) emails++
      if (b.website) websites++
      if (b.totalScore) totalRating += b.totalScore

      // Check for garbage emails
      if (b.email) {
        const nonAsciiChars = b.email.replace(/[\x00-\x7F]/g, '').length
        const binaryRatio = nonAsciiChars / b.email.length
        if (binaryRatio > 0.3) garbageEmails++
      }
    }

    return {
      businesses: qualifyingBusinesses.length,
      reviews: results.reviews.length,
      enriched,
      avgRating: qualifyingBusinesses.length > 0 ? totalRating / qualifyingBusinesses.length : 0,
      phoneNumbers,
      emails,
      websites,
      garbageEmails
    }
  }, [results, qualifyingBusinesses])

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced History Sidebar */}
      <EnhancedHistorySidebar
        isOpen={showHistory}
        onLoadExtraction={handleLoadExtraction}
        onClose={() => setShowHistory(false)}
        currentExtractionId={currentExtractionId}
        refreshTrigger={historyRefreshTrigger}
      />

      {/* Main Content */}
      <div className="space-y-8 p-6">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <Card className="p-8 text-center">
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <Gem className="h-12 w-12 text-primary" />
                
                <div>
                  <h1 className="text-4xl font-bold text-primary">
                    QuartzIQ
                  </h1>
                </div>

                <div className="absolute top-4 right-4 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettingsModal(true)}
                    className="bg-white/10 backdrop-blur-sm border border-white/20"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDarkMode(!darkMode)}
                    className="bg-white/10 backdrop-blur-sm border border-white/20"
                  >
                    {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Quick Stats */}
            </div>
          </Card>
        </motion.div>


        {/* Search Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Search Configuration</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure search parameters
                  </p>
                </div>
                {currentExtractionId && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30"
                  >
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-300 font-medium">Loaded from vault</span>
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowHistory(true)}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 hover:scale-105 hover:shadow-lg transition-all duration-200"
                >
                  <History className="h-4 w-4 mr-2" />
                  Contact Vault
                </Button>
              </div>
            </div>

            <EnhancedSearchForm onSearch={handleSearch} isExtracting={isExtracting} />
          </Card>
        </motion.div>

        {/* Search Criteria Overview */}
        <AnimatePresence>
          {lastSearchCriteria && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Search Criteria</h3>
                      <p className="text-sm text-muted-foreground">Current extraction parameters</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Category</div>
                    <div className="font-medium text-sm">{lastSearchCriteria.category}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Target Location</div>
                    <div className="font-medium text-sm flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary" />
                      {lastSearchCriteria.location}
                    </div>
                  </div>

                  {(lastSearchCriteria.minRating || lastSearchCriteria.maxRating) && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Business Rating</div>
                      <div className="font-medium text-sm flex items-center gap-1">
                        <Star className="h-3 w-3 text-primary" />
                        {lastSearchCriteria.minRating && lastSearchCriteria.maxRating
                          ? `${lastSearchCriteria.minRating} - ${lastSearchCriteria.maxRating}`
                          : lastSearchCriteria.minRating
                            ? `≥ ${lastSearchCriteria.minRating}`
                            : `≤ ${lastSearchCriteria.maxRating}`
                        }
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Max Review Stars</div>
                    <div className="font-medium text-sm flex items-center gap-1">
                      <Star className="h-3 w-3 text-primary" />
                      ≤ {lastSearchCriteria.maxStars}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Time Window</div>
                    <div className="font-medium text-sm flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-primary" />
                      {lastSearchCriteria.dayLimit} days
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Business Limit</div>
                    <div className="font-medium text-sm flex items-center gap-1">
                      <Building className="h-3 w-3 text-primary" />
                      {lastSearchCriteria.businessLimit}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Indicators */}
        <AnimatePresence>
          {isExtracting && (
            <EnhancedExtractionProgress 
              progress={progress} 
              currentStep={currentStep}
              isVisible={true}
            />
          )}

          {isEnrichingContacts && (
            <EnhancedExtractionProgress 
              progress={enrichmentProgress} 
              currentStep={enrichmentStep}
              isVisible={true}
            />
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="p-4">
                <div className="space-y-4">
                  {/* Results Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-4 mb-1">
                          <h2 className="text-lg font-semibold text-foreground">Intelligence Results</h2>
                          <TooltipProvider>
                            <div className="flex items-center gap-3 text-sm">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <Building className="h-3 w-3 text-primary" />
                                    <span className="font-medium">{statsData?.businesses}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Businesses Found</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <MessageSquare className="h-3 w-3 text-primary" />
                                    <span className="font-medium">{statsData?.reviews}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Total Reviews</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <Star className="h-3 w-3 text-primary" />
                                    <span className="font-medium">{statsData?.avgRating.toFixed(1)}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Average Rating</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <Phone className="h-3 w-3 text-primary" />
                                    <span className="font-medium">{statsData?.phoneNumbers}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Phone Numbers</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <Mail className="h-3 w-3 text-primary" />
                                    <span className="font-medium">{statsData?.emails}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Email Addresses</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <Globe className="h-3 w-3 text-primary" />
                                    <span className="font-medium">{statsData?.websites}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Websites</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Found {qualifyingBusinesses.length} qualifying businesses • {results.reviews.length} reviews analyzed
                          {statsData?.enriched && statsData.enriched > 0 && (
                            <span className="ml-2 text-green-400 font-medium">
                              • {statsData.enriched} contacts available
                            </span>
                          )}
                          {qualifyingBusinesses.length > 0 && (!statsData?.enriched || statsData.enriched === 0) && (
                            <span className="ml-2 text-amber-400 font-medium">
                              • No contact information found in scraped data
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">

                      {/* View Mode Toggle */}
                      <div className="flex items-center border rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                        <Button
                          variant={viewMode === 'cards' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            console.log('Clicking cards button, current viewMode:', viewMode)
                            changeViewMode('cards')
                          }}
                          className={cn(
                            "border-0",
                            viewMode === 'cards' && "bg-primary text-primary-foreground"
                          )}
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'table' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            console.log('Clicking table button, current viewMode:', viewMode)
                            changeViewMode('table')
                          }}
                          className={cn(
                            "border-0",
                            viewMode === 'table' && "bg-primary text-primary-foreground"
                          )}
                        >
                          <Table className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'list' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            console.log('Clicking list button, current viewMode:', viewMode)
                            changeViewMode('list')
                          }}
                          className={cn(
                            "border-0",
                            viewMode === 'list' && "bg-primary text-primary-foreground"
                          )}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Quality Sort Controls */}
                      <div className="flex items-center border rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={qualitySortOrder === 'desc' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setQualitySortOrder(qualitySortOrder === 'desc' ? 'none' : 'desc')}
                                className={cn(
                                  "border-0 gap-1",
                                  qualitySortOrder === 'desc' && "bg-primary text-primary-foreground"
                                )}
                              >
                                <Award className="h-4 w-4" />
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Sort by Lead Quality (High to Low)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={qualitySortOrder === 'asc' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setQualitySortOrder(qualitySortOrder === 'asc' ? 'none' : 'asc')}
                                className={cn(
                                  "border-0 gap-1",
                                  qualitySortOrder === 'asc' && "bg-primary text-primary-foreground"
                                )}
                              >
                                <Award className="h-4 w-4" />
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Sort by Lead Quality (Low to High)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowQualityLegend(!showQualityLegend)}
                                className="border-0"
                              >
                                <HelpCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Lead Quality Scoring Guide</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExportModal(true)}
                        className="bg-white/10 backdrop-blur-sm border border-white/20 hover:scale-105 hover:shadow-lg transition-all duration-200"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>

                      {/* Send to Quartz Leads Button */}
                      {(() => {
                        const enrichedCount = qualifyingBusinesses.filter((b: any) =>
                          b.phone || b.email || b.website
                        ).length

                        return enrichedCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowLeadSelectionModal(true)}
                            className="bg-primary/10 backdrop-blur-sm border border-primary/20 hover:scale-105 hover:shadow-lg transition-all duration-200 text-primary hover:text-primary"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Send to CRM ({enrichedCount})
                          </Button>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Business Selection Controls */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectAllBusinesses(!selectAll)}
                        className="bg-white/10 backdrop-blur-sm border border-white/20"
                      >
                        {selectAll ? 'Deselect All' : 'Select All'}
                      </Button>

                      {/* Contact Enrichment Button */}
                      {!isEnrichingContacts && results.businesses.length > 0 && (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="relative"
                        >
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={() => handleContactEnrichment(false)}
                            disabled={isExtracting || selectedBusinesses.size === 0}
                            className="bg-[#d97757] hover:bg-[#c66946] text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border-0"
                          >
                            <Phone className="h-5 w-5 mr-2" />
                            Get Contact Info ({selectedBusinesses.size})
                          </Button>
                          {selectedBusinesses.size > 0 && (
                            <motion.div
                              className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}
                        </motion.div>
                      )}



                      <span className="text-sm text-muted-foreground">
                        {selectedBusinesses.size} of {qualifyingBusinesses.length} qualifying businesses selected
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        Ready for contact enrichment and export
                      </span>
                    </div>
                  </div>

                  {/* Results Display */}
                  <div className="space-y-4">
                    {console.log('Rendering view, current viewMode:', viewMode) || null}

                    {viewMode === 'cards' && (
                      <motion.div
                        key="cards-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                      >
                        {console.log('Rendering CARDS view - Qualifying Business Grid') || null}
                        {qualifyingBusinesses.map((business: any, index) => (
                          <EnhancedBusinessCard
                            key={business.placeId || index}
                            business={business}
                            searchCriteria={results?.searchCriteria}
                            index={index}
                            isSelected={selectedBusinesses.has(index.toString())}
                            onToggleSelect={() => handleBusinessSelect(index, !selectedBusinesses.has(index.toString()))}
                          />
                        ))}
                      </motion.div>
                    )}

                    {viewMode === 'table' && (
                      <motion.div
                        key="table-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {console.log('Rendering TABLE view - Reviews Table') || null}
                        <ResultsTable
                          results={results}
                          qualifyingBusinesses={qualifyingBusinesses}
                          selectedReviews={selectedReviews}
                          onReviewSelect={handleReviewSelect}
                          selectAll={selectAll}
                          onSelectAll={handleSelectAllReviews}
                        />
                      </motion.div>
                    )}

                    {viewMode === 'list' && (
                      <motion.div
                        key="list-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {console.log('Rendering LIST view - Reviews List') || null}
                        <ResultsList
                          results={results}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export Modal */}
        {showExportModal && results && (
          <ExportModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            results={results}
          />
        )}

        {/* Settings Modal */}
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />

        {/* Lead Selection Modal */}
        {qualifyingBusinesses.length > 0 && (
          <LeadSelectionModal
            isOpen={showLeadSelectionModal}
            onClose={() => setShowLeadSelectionModal(false)}
            enrichedBusinesses={qualifyingBusinesses}
            selectedClientId={selectedClientId}
          />
        )}

        {/* Quality Legend Modal */}
        <AnimatePresence>
          {showQualityLegend && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowQualityLegend(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-background rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Award className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Lead Quality Scoring Guide</h2>
                        <p className="text-sm text-muted-foreground">Understanding how businesses are ranked</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowQualityLegend(false)}
                      className="rounded-full"
                    >
                      ×
                    </Button>
                  </div>

                  {/* Quality Tiers */}
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Quality Tiers
                    </h3>
                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
                        <Award className="h-5 w-5 text-yellow-400" />
                        <div className="flex-1">
                          <div className="font-medium text-yellow-400">Platinum (80-100 points)</div>
                          <div className="text-sm text-muted-foreground">Exceptional leads - highly responsive, established businesses</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
                        <Award className="h-5 w-5 text-green-400" />
                        <div className="flex-1">
                          <div className="font-medium text-green-400">Gold (70-79 points)</div>
                          <div className="text-sm text-muted-foreground">High-quality leads with good engagement patterns</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                        <Award className="h-5 w-5 text-blue-400" />
                        <div className="flex-1">
                          <div className="font-medium text-blue-400">Silver (60-69 points)</div>
                          <div className="text-sm text-muted-foreground">Solid leads worth pursuing with moderate engagement</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-gray-500/20 to-slate-500/20 border border-gray-500/30">
                        <Award className="h-5 w-5 text-gray-400" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-400">Bronze (0-59 points)</div>
                          <div className="text-sm text-muted-foreground">Entry-level leads that may require more nurturing</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scoring Factors */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Scoring Factors
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <div className="font-medium">Response Rate (0-25 points)</div>
                          <div className="text-sm text-muted-foreground">How often the business responds to customer reviews</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <Users className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <div className="font-medium">Review Volume (0-20 points)</div>
                          <div className="text-sm text-muted-foreground">Total number of reviews indicates business maturity</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <Star className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <div className="font-medium">Average Rating (0-20 points)</div>
                          <div className="text-sm text-muted-foreground">Higher ratings suggest better service quality</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <Calendar className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <div className="font-medium">Recent Activity (0-15 points)</div>
                          <div className="text-sm text-muted-foreground">Recent reviews indicate active, growing business</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <Building className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <div className="font-medium">Review Quality (0-20 points)</div>
                          <div className="text-sm text-muted-foreground">Detailed reviews suggest engaged customer base</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium text-primary">Pro Tip</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Focus your outreach efforts on Platinum and Gold leads first - they have the highest likelihood
                          of engagement and conversion based on their digital behavior patterns.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Button */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1 }}
          className="fixed bottom-6 right-6 z-30"
        >
          <Button
            size="lg"
            onClick={() => setShowHistory(true)}
            className="rounded-full shadow-2xl bg-primary text-primary-foreground border-0"
          >
            <History className="h-5 w-5 mr-2" />
            <span className="hidden sm:inline">Contact Vault</span>
          </Button>
        </motion.div>
      </div>
    </div>
  )
}