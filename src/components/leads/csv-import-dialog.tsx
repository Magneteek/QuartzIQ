'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface ImportRow {
  business_name: string
  city?: string
  country?: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  total_reviews?: number
}

interface ImportResult {
  success: boolean
  row: number
  business_name: string
  error?: string
}

export function CSVImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [previewData, setPreviewData] = useState<ImportRow[]>([])
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setShowResults(false)
    setImportResults([])

    // Parse CSV for preview
    try {
      const text = await selectedFile.text()
      const rows = parseCSV(text)
      setPreviewData(rows.slice(0, 10)) // Show first 10 rows
    } catch (error) {
      console.error('Error parsing CSV:', error)
      alert('Failed to parse CSV file')
    }
  }

  const parseCSV = (text: string): ImportRow[] => {
    const lines = text.split('\n').filter((line) => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const rows: ImportRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const row: any = {}

      headers.forEach((header, index) => {
        const value = values[index]
        if (value) {
          // Map common header variations
          if (header.includes('business') || header.includes('name')) {
            row.business_name = value
          } else if (header.includes('city')) {
            row.city = value
          } else if (header.includes('country')) {
            row.country = value
          } else if (header.includes('address') || header.includes('street')) {
            row.address = value
          } else if (header.includes('phone') || header.includes('tel')) {
            row.phone = value
          } else if (header.includes('website') || header.includes('url')) {
            row.website = value
          } else if (header.includes('rating')) {
            row.rating = parseFloat(value)
          } else if (header.includes('review')) {
            row.total_reviews = parseInt(value)
          }
        }
      })

      if (row.business_name) {
        rows.push(row)
      }
    }

    return rows
  }

  const handleImport = async () => {
    if (!file) return

    setIsUploading(true)
    setShowResults(false)

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      const response = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businesses: rows }),
      })

      if (!response.ok) {
        throw new Error('Failed to import businesses')
      }

      const data = await response.json()
      setImportResults(data.results || [])
      setShowResults(true)

      if (data.results.every((r: ImportResult) => r.success)) {
        setTimeout(() => {
          onSuccess()
          onOpenChange(false)
          resetDialog()
        }, 2000)
      }
    } catch (error) {
      console.error('Error importing CSV:', error)
      alert('Failed to import CSV file')
    } finally {
      setIsUploading(false)
    }
  }

  const resetDialog = () => {
    setFile(null)
    setPreviewData([])
    setImportResults([])
    setShowResults(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetDialog()
    onOpenChange(false)
  }

  const successCount = importResults.filter((r) => r.success).length
  const errorCount = importResults.filter((r) => !r.success).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Businesses from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with business data. Required column: business_name
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <>
            {/* File Upload */}
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <FileText className="h-12 w-12 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">CSV files only</p>
                  </div>
                  {file && (
                    <Badge variant="secondary" className="mt-2">
                      {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </Badge>
                  )}
                </label>
              </div>

              {/* CSV Format Guide */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  CSV Format Guide
                </h4>
                <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <li>
                    <strong>Required:</strong> business_name
                  </li>
                  <li>
                    <strong>Optional:</strong> city, country, address, phone, website,
                    rating, total_reviews
                  </li>
                  <li>• First row must contain column headers</li>
                  <li>• Values with commas must be in quotes</li>
                </ul>
              </div>

              {/* Preview */}
              {previewData.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Preview (first 10 rows)
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Business Name</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {row.business_name}
                            </TableCell>
                            <TableCell>{row.city || '-'}</TableCell>
                            <TableCell>{row.country || '-'}</TableCell>
                            <TableCell>{row.phone || '-'}</TableCell>
                            <TableCell>
                              {row.rating ? `${row.rating}/5` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || isUploading}
              >
                {isUploading ? 'Importing...' : 'Import Businesses'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Import Results */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{successCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Imported Successfully
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold">{errorCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Failed
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {errorCount > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Errors</h4>
                  <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Business Name</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResults
                          .filter((r) => !r.success)
                          .map((result, index) => (
                            <TableRow key={index}>
                              <TableCell>{result.row}</TableCell>
                              <TableCell>{result.business_name}</TableCell>
                              <TableCell className="text-red-600">
                                {result.error}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
