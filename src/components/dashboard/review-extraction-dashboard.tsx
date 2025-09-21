'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchForm } from '@/components/forms/search-form'
import { ResultsTable } from '@/components/results/results-table'
import { ResultsList } from '@/components/results/results-list'
import { ExtractionProgress } from '@/components/results/extraction-progress'
import { ExportModal } from '@/components/modals/export-modal'
import { HistorySidebar } from '@/components/history/history-sidebar'
import { Button } from '@/components/ui/button'
import { Database, Download, List, Table, Users, Phone, Mail, Globe, History, RotateCcw } from 'lucide-react'

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
  // Contact Information
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

export function ReviewExtractionDashboard() {
  const [isExtracting, setIsExtracting] = useState(false)
  const [results, setResults] = useState<ExtractionResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table')
  const [showExportModal, setShowExportModal] = useState(false)

  // Contact enrichment state
  const [isEnrichingContacts, setIsEnrichingContacts] = useState(false)
  const [enrichmentProgress, setEnrichmentProgress] = useState(0)
  const [enrichmentStep, setEnrichmentStep] = useState('')

  // Review selection state
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // History state
  const [showHistory, setShowHistory] = useState(false)
  const [currentExtractionId, setCurrentExtractionId] = useState<string | null>(null)
  const [lastSearchCriteria, setLastSearchCriteria] = useState<SearchCriteria | null>(null)

  const handleSearch = async (criteria: SearchCriteria) => {
    setIsExtracting(true)
    setProgress(0)
    setCurrentStep('Initializing extraction...')
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
              console.log(`📚 Extraction automatically saved to history: ${saveData.data.id}`)
            }
          }
        } catch (error) {
          console.warn('Failed to save extraction to history:', error)
        }
      }

    } catch (error) {
      console.error('Extraction error:', error)
      setCurrentStep('Extraction failed')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleContactEnrichment = async (includeApifyEnrichment = false) => {
    console.log('🚀 Starting contact enrichment process...')
    console.log('Results available:', !!results)
    console.log('Businesses count:', results?.businesses.length || 0)
    console.log('Selected reviews count:', selectedReviews.size)

    if (!results || !results.businesses.length || selectedReviews.size === 0) {
      alert('Please select at least one review for contact enrichment.')
      return
    }

    // Get unique businesses from selected reviews
    console.log('Selected review indices:', Array.from(selectedReviews))

    const selectedBusinessTitles = new Set(
      Array.from(selectedReviews).map(reviewIndex => {
        const review = results.reviews[parseInt(reviewIndex)]
        console.log(`Review ${reviewIndex}: ${review?.title || 'NO TITLE'}`)
        return review?.title
      }).filter(Boolean)
    )

    console.log('Selected business titles:', Array.from(selectedBusinessTitles))

    const businessesToEnrich = results.businesses.filter((business: any) =>
      selectedBusinessTitles.has(business.title)
    )

    console.log('Businesses to enrich:', businessesToEnrich.length)
    console.log('Business details:', businessesToEnrich.map(b => ({ title: b.title, placeId: b.placeId })))

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
          extractionId: currentExtractionId, // Pass extraction ID for history saving
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
                // Update results with enriched business data
                setResults(prev => prev ? {
                  ...prev,
                  businesses: data.businesses
                } : null)

                // Update history with enrichment data
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

  // Review selection handlers
  const handleReviewSelect = (reviewIndex: number, isSelected: boolean) => {
    const newSelected = new Set(selectedReviews)
    if (isSelected) {
      newSelected.add(reviewIndex.toString())
    } else {
      newSelected.delete(reviewIndex.toString())
    }
    setSelectedReviews(newSelected)
    setSelectAll(newSelected.size === results?.reviews.length)
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
  React.useEffect(() => {
    setSelectedReviews(new Set())
    setSelectAll(false)
  }, [results])

  return (
    <div className="space-y-6 relative">
      {/* History Sidebar */}
      <HistorySidebar
        isOpen={showHistory}
        onLoadExtraction={handleLoadExtraction}
        onClose={() => setShowHistory(false)}
        currentExtractionId={currentExtractionId}
      />

      {/* Header with History Access */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Search Parameters
                {currentExtractionId && (
                  <div className="flex items-center gap-2 ml-4">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-muted-foreground">Loaded from vault</span>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Configure your business review extraction criteria
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              Contact Vault
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SearchForm onSearch={handleSearch} isExtracting={isExtracting} />
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      {isExtracting && (
        <Card>
          <CardHeader>
            <CardTitle>Extraction Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ExtractionProgress progress={progress} currentStep={currentStep} />
          </CardContent>
        </Card>
      )}

      {/* Contact Enrichment Progress */}
      {isEnrichingContacts && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Enrichment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ExtractionProgress progress={enrichmentProgress} currentStep={enrichmentStep} />
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Extraction Results</CardTitle>
                <CardDescription>
                  Found {results.businesses.length} businesses and {results.reviews.length} reviews
                  {results.businesses.filter((b: any) => b.contactEnriched).length > 0 && (
                    <span className="ml-2 text-green-600 font-medium">
                      • {results.businesses.filter((b: any) => b.contactEnriched).length} enriched with contacts
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* Contact Vault Access Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  Vault
                </Button>

                {/* Contact Enrichment Controls */}
                {!isEnrichingContacts && results.businesses.length > 0 && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleContactEnrichment(false)}
                      disabled={isExtracting || selectedReviews.size === 0}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Get All Contact Info ({selectedReviews.size} selected)
                    </Button>
                  </>
                )}

                {/* View Mode Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'table' ? 'list' : 'table')}
                >
                  {viewMode === 'table' ? (
                    <>
                      <List className="h-4 w-4 mr-2" />
                      List View
                    </>
                  ) : (
                    <>
                      <Table className="h-4 w-4 mr-2" />
                      Table View
                    </>
                  )}
                </Button>

                {/* Export Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportModal(true)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Contact Enrichment Info Banner */}
            {results.businesses.length > 0 && !isEnrichingContacts && results.businesses.filter((b: any) => b.contactEnriched).length === 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-blue-900">Get Contact Information</div>
                    <div className="text-blue-700 mt-1">
                      <strong>Get All Contact Info:</strong> Phone numbers, websites, and email addresses (~$0.003 per business)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="mt-4">
              {viewMode === 'table' ? (
                <ResultsTable
                  results={results}
                  selectedReviews={selectedReviews}
                  onReviewSelect={handleReviewSelect}
                  selectAll={selectAll}
                  onSelectAll={handleSelectAllReviews}
                />
              ) : (
                <ResultsList
                  results={results}
                  selectedReviews={selectedReviews}
                  onReviewSelect={handleReviewSelect}
                  selectAll={selectAll}
                  onSelectAll={handleSelectAllReviews}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Modal */}
      {showExportModal && results && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          results={results}
        />
      )}

      {/* Floating Contact Vault Access Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="lg"
          onClick={() => setShowHistory(true)}
          className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        >
          <History className="h-5 w-5" />
          <span className="hidden sm:inline">Vault</span>
        </Button>
      </div>
    </div>
  )
}