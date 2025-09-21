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
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchCriteria {
  [key: string]: unknown
  category: string
  location: string
  maxRating: number
  maxStars: number
  dayLimit: number
  businessLimit: number
  minReviews: number
  minTextLength: number
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
  const [viewMode, setViewMode] = useState<'table' | 'list' | 'cards'>('table')
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showLeadSelectionModal, setShowLeadSelectionModal] = useState(false)
  const [darkMode, setDarkMode] = useState(true)

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

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const handleSearch = async (criteria: SearchCriteria) => {
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
            }
          }
        } catch (error) {
          console.warn('Failed to save extraction to history:', error)
        }
      }

    } catch (error) {
      console.error('Extraction error:', error)
      setCurrentStep('Extraction failed - please try again')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleContactEnrichment = async (includeApifyEnrichment = false) => {
    if (!results || !results.businesses.length || selectedBusinesses.size === 0) {
      alert('Please select at least one business for contact enrichment.')
      return
    }

    const businessesToEnrich = results.businesses.filter((business: any, index) =>
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
    }
  }

  // Business selection handlers
  const handleBusinessSelect = (businessIndex: number, isSelected: boolean) => {
    const newSelected = new Set(selectedBusinesses)
    if (isSelected) {
      newSelected.add(businessIndex.toString())
    } else {
      newSelected.delete(businessIndex.toString())
    }
    setSelectedBusinesses(newSelected)
  }

  const handleSelectAllBusinesses = (selectAll: boolean) => {
    if (selectAll && results) {
      const allBusinessIndices = new Set(results.businesses.map((_, index) => index.toString()))
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

  const statsData = results ? {
    businesses: results.businesses.length,
    reviews: results.reviews.length,
    enriched: results.businesses.filter((b: any) => b.contactEnriched).length,
    avgRating: results.businesses.reduce((acc: number, b: any) => acc + (b.totalScore || 0), 0) / results.businesses.length || 0,
    phoneNumbers: results.businesses.filter((b: any) => b.phone).length,
    emails: results.businesses.filter((b: any) => b.email).length,
    websites: results.businesses.filter((b: any) => b.website).length
  } : null

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced History Sidebar */}
      <EnhancedHistorySidebar
        isOpen={showHistory}
        onLoadExtraction={handleLoadExtraction}
        onClose={() => setShowHistory(false)}
        currentExtractionId={currentExtractionId}
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
                          Found {results.businesses.length} businesses • {results.reviews.length} reviews analyzed
                          {results.businesses.filter((b: any) => b.contactEnriched).length > 0 && (
                            <span className="ml-2 text-green-400 font-medium">
                              • {results.businesses.filter((b: any) => b.contactEnriched).length} contacts enriched
                            </span>
                          )}
                          {results.businesses.length > 0 && results.businesses.filter((b: any) => b.contactEnriched).length === 0 && (
                            <span className="ml-2 text-amber-400 font-medium">
                              • Contact enrichment attempted but failed (API quota may be exceeded)
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
                          onClick={() => setViewMode('cards')}
                          className="border-0"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'table' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setViewMode('table')}
                          className="border-0"
                        >
                          <Table className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'list' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setViewMode('list')}
                          className="border-0"
                        >
                          <List className="h-4 w-4" />
                        </Button>
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
                        const enrichedCount = results.businesses.filter((b: any) =>
                          b.contactEnriched && (b.phone || b.email || b.website)
                        ).length

                        return enrichedCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowLeadSelectionModal(true)}
                            className="bg-primary/10 backdrop-blur-sm border border-primary/20 hover:scale-105 hover:shadow-lg transition-all duration-200 text-primary hover:text-primary"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Send to Quartz Leads ({enrichedCount})
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
                            <Mail className="h-5 w-5 mr-2" />
                            Get Email Info ({selectedBusinesses.size})
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
                        {selectedBusinesses.size} of {results.businesses.length} businesses selected
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
                    {viewMode === 'cards' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                      >
                        {results.businesses.map((business: any, index) => (
                          <EnhancedBusinessCard
                            key={business.placeId || index}
                            business={business}
                            index={index}
                            isSelected={selectedBusinesses.has(index.toString())}
                            onToggleSelect={() => handleBusinessSelect(index, !selectedBusinesses.has(index.toString()))}
                          />
                        ))}
                      </motion.div>
                    )}

                    {viewMode === 'table' && (
                      <ResultsTable
                        results={results}
                        selectedReviews={selectedReviews}
                        onReviewSelect={handleReviewSelect}
                        selectAll={selectAll}
                        onSelectAll={handleSelectAllReviews}
                      />
                    )}

                    {viewMode === 'list' && (
                      <ResultsList
                        results={results}
                        selectedReviews={selectedReviews}
                        onReviewSelect={handleReviewSelect}
                        selectAll={selectAll}
                        onSelectAll={handleSelectAllReviews}
                      />
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
        {results && (
          <LeadSelectionModal
            isOpen={showLeadSelectionModal}
            onClose={() => setShowLeadSelectionModal(false)}
            enrichedBusinesses={results.businesses}
          />
        )}

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