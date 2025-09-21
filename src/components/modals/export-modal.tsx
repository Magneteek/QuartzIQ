'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Download, FileText, Table, Database, CheckCircle, Loader2 } from 'lucide-react'

interface ReviewData {
  [key: string]: string | number | boolean
}

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  results: {
    businesses: ReviewData[]
    reviews: ReviewData[]
    searchCriteria: Record<string, unknown>
    extractionDate: Date
  }
}

const exportFormats = [
  {
    id: 'json',
    name: 'JSON',
    description: 'Raw data in JSON format',
    icon: Database,
    extension: 'json'
  },
  {
    id: 'csv',
    name: 'CSV',
    description: 'Spreadsheet-compatible format',
    icon: Table,
    extension: 'csv'
  },
  {
    id: 'excel',
    name: 'Excel',
    description: 'Microsoft Excel format',
    icon: FileText,
    extension: 'xlsx'
  }
]

const fieldOptions = [
  { id: 'title', label: 'Business Name', category: 'business' },
  { id: 'address', label: 'Business Address', category: 'business' },
  { id: 'totalScore', label: 'Business Rating', category: 'business' },
  { id: 'reviewsCount', label: 'Total Reviews Count', category: 'business' },
  { id: 'placeId', label: 'Google Place ID', category: 'business' },

  // Contact Information Fields (Enhanced Email Extraction)
  { id: 'phone', label: 'Phone Number', category: 'contact' },
  { id: 'website', label: 'Website URL', category: 'contact' },
  { id: 'email', label: 'Email Address', category: 'contact' },
  { id: 'contactEnriched', label: 'Contact Enriched Status', category: 'contact' },
  { id: 'enrichmentDate', label: 'Enrichment Date', category: 'contact' },

  // Reviewer Information
  { id: 'name', label: 'Reviewer Name', category: 'reviewer' },
  { id: 'reviewerNumberOfReviews', label: 'Reviewer Total Reviews', category: 'reviewer' },
  { id: 'isLocalGuide', label: 'Local Guide Status', category: 'reviewer' },

  // Review Content
  { id: 'stars', label: 'Rating Stars', category: 'review' },
  { id: 'publishedAtDate', label: 'Review Date', category: 'review' },
  { id: 'text', label: 'Review Text', category: 'review' },
  { id: 'originalLanguage', label: 'Review Language', category: 'review' },

  // URLs & Links
  { id: 'reviewUrl', label: 'Review URL', category: 'links' },
  { id: 'reviewerUrl', label: 'Reviewer Profile URL', category: 'links' },
  { id: 'url', label: 'Business URL', category: 'links' },
]

export function ExportModal({ isOpen, onClose, results }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState('csv')
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'title', 'address', 'phone', 'website', 'email', 'contactEnriched', 'name', 'stars', 'publishedAtDate', 'text'
  ])
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const handleFieldToggle = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    )
  }

  const handleSelectAll = () => {
    setSelectedFields(fieldOptions.map(f => f.id))
  }

  const handleSelectNone = () => {
    setSelectedFields([])
  }

  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)
    setDownloadUrl(null)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: selectedFormat,
          fields: selectedFields,
          data: results
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      setExportProgress(100)

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setDownloadUrl(url)

      // Auto-download
      const format = exportFormats.find(f => f.id === selectedFormat)
      const filename = `business-reviews-${new Date().toISOString().split('T')[0]}.${format?.extension}`

      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

    } catch (error) {
      console.error('Export error:', error)
      setExportProgress(0)
    } finally {
      setIsExporting(false)
    }
  }

  const getFieldsByCategory = (category: string) => {
    return fieldOptions.filter(field => field.category === category)
  }

  const categories = [
    { id: 'business', label: 'Business Information', icon: '🏢' },
    { id: 'contact', label: 'Contact Information', icon: '📞' },
    { id: 'reviewer', label: 'Reviewer Information', icon: '👤' },
    { id: 'review', label: 'Review Content', icon: '⭐' },
    { id: 'links', label: 'URLs & Links', icon: '🔗' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Review Data</DialogTitle>
          <DialogDescription>
            Export {results.reviews.length} reviews from {results.businesses.length} businesses
            {(() => {
              const enrichedCount = results.businesses.filter((b: any) => b.contactEnriched).length
              const phoneCount = results.businesses.filter((b: any) => b.phone).length
              const emailCount = results.businesses.filter((b: any) => b.email).length

              if (enrichedCount > 0) {
                return (
                  <div className="mt-2 text-sm">
                    <span className="text-green-600 font-medium">
                      • {enrichedCount} businesses with contact data
                    </span>
                    {phoneCount > 0 && <span className="ml-2">• {phoneCount} phone numbers</span>}
                    {emailCount > 0 && <span className="ml-2">• {emailCount} email addresses</span>}
                  </div>
                )
              }
              return null
            })()}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedFormat} onValueChange={setSelectedFormat} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {exportFormats.map(format => {
              const Icon = format.icon
              return (
                <TabsTrigger key={format.id} value={format.id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {format.name}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {exportFormats.map(format => (
            <TabsContent key={format.id} value={format.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <format.icon className="h-5 w-5" />
                    {format.name} Export
                  </CardTitle>
                  <CardDescription>{format.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <Label className="font-medium">File Format</Label>
                      <p className="text-muted-foreground">.{format.extension}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Records</Label>
                      <p className="text-muted-foreground">{results.reviews.length} reviews</p>
                    </div>
                    <div>
                      <Label className="font-medium">Fields</Label>
                      <p className="text-muted-foreground">{selectedFields.length} selected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Field Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Fields to Export</CardTitle>
                <CardDescription>Choose which data fields to include in your export</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleSelectNone}>
                  Select None
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.map(category => {
              const categoryFields = getFieldsByCategory(category.id)
              const selectedInCategory = categoryFields.filter(f => selectedFields.includes(f.id)).length

              return (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{category.icon}</span>
                    <Label className="font-medium">{category.label}</Label>
                    <Badge variant="secondary" className="text-xs">
                      {selectedInCategory}/{categoryFields.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-8">
                    {categoryFields.map(field => (
                      <label key={field.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.id)}
                          onChange={() => handleFieldToggle(field.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Export Progress */}
        {isExporting && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Exporting data...</span>
                  <span className="text-sm">{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Message */}
        {downloadUrl && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Export completed successfully!</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Your file has been downloaded automatically.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedFields.length} fields selected • {results.reviews.length} records
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || selectedFields.length === 0}
              className="min-w-[120px]"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}