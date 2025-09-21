/**
 * Extraction History Manager
 * Manages saving, loading, and organizing extraction results for reuse
 */

import fs from 'fs/promises'
import path from 'path'

export interface ExtractionHistoryItem {
  id: string
  timestamp: Date
  searchCriteria: {
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
  results: {
    businesses: Record<string, unknown>[]
    reviews: Record<string, unknown>[]
    extractionDate: Date
  }
  statistics: {
    businessesFound: number
    reviewsFound: number
    avgRating: number
    extractionTime: number
  }
  enrichmentHistory?: {
    timestamp: Date
    enrichedBusinesses: number
    phoneNumbers: number
    websites: number
    emails: number
  }[]
}

export class HistoryManager {
  private historyDir: string
  private indexFile: string

  constructor() {
    this.historyDir = path.join(process.cwd(), 'data', 'extraction-history')
    this.indexFile = path.join(this.historyDir, 'index.json')
  }

  /**
   * Initialize history directory structure
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.historyDir, { recursive: true })

      // Create index file if it doesn't exist
      try {
        await fs.access(this.indexFile)
      } catch {
        await fs.writeFile(this.indexFile, JSON.stringify([]))
      }
    } catch (error) {
      console.error('Failed to initialize history directory:', error)
    }
  }

  /**
   * Save extraction results to history
   */
  async saveExtraction(
    searchCriteria: any,
    results: any,
    extractionTime: number
  ): Promise<string> {
    await this.initialize()

    const id = `extraction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timestamp = new Date()

    const historyItem: ExtractionHistoryItem = {
      id,
      timestamp,
      searchCriteria,
      results: {
        ...results,
        extractionDate: timestamp
      },
      statistics: {
        businessesFound: results.businesses?.length || 0,
        reviewsFound: results.reviews?.length || 0,
        avgRating: results.reviews?.length > 0
          ? results.reviews.reduce((sum: number, review: any) => sum + review.stars, 0) / results.reviews.length
          : 0,
        extractionTime
      }
    }

    try {
      // Save detailed data to individual file
      const dataFile = path.join(this.historyDir, `${id}.json`)
      await fs.writeFile(dataFile, JSON.stringify(historyItem, null, 2))

      // Update index with summary
      const index = await this.getIndex()
      const summary = {
        id: historyItem.id,
        timestamp: historyItem.timestamp,
        searchCriteria: {
          category: historyItem.searchCriteria.category,
          location: historyItem.searchCriteria.location,
          countryCode: historyItem.searchCriteria.countryCode
        },
        statistics: historyItem.statistics,
        enrichmentHistory: historyItem.enrichmentHistory || []
      }

      index.unshift(summary) // Add to beginning for recent-first order

      // Keep only last 50 extractions in index
      if (index.length > 50) {
        const removed = index.splice(50)
        // Clean up old files
        for (const item of removed) {
          try {
            await fs.unlink(path.join(this.historyDir, `${item.id}.json`))
          } catch (error) {
            console.warn(`Failed to delete old extraction file: ${item.id}`)
          }
        }
      }

      await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2))

      console.log(`📚 Extraction saved to history: ${id}`)
      return id

    } catch (error) {
      console.error('Failed to save extraction to history:', error)
      throw error
    }
  }

  /**
   * Load extraction by ID
   */
  async loadExtraction(id: string): Promise<ExtractionHistoryItem | null> {
    try {
      const dataFile = path.join(this.historyDir, `${id}.json`)
      const content = await fs.readFile(dataFile, 'utf-8')
      const extraction = JSON.parse(content)

      // Convert date strings back to Date objects
      extraction.timestamp = new Date(extraction.timestamp)
      extraction.results.extractionDate = new Date(extraction.results.extractionDate)
      if (extraction.enrichmentHistory) {
        extraction.enrichmentHistory = extraction.enrichmentHistory.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
      }

      return extraction
    } catch (error) {
      console.error(`Failed to load extraction ${id}:`, error)
      return null
    }
  }

  /**
   * Get history index (summaries only)
   */
  async getIndex(): Promise<any[]> {
    try {
      const content = await fs.readFile(this.indexFile, 'utf-8')
      const index = JSON.parse(content)

      // Check if index has old format and needs migration
      if (index.length > 0 && index[0].category !== undefined && index[0].searchCriteria === undefined) {
        console.log('📦 Migrating old index format to new nested structure...')
        return await this.migrateAndGetIndex()
      }

      // Convert date strings back to Date objects in summaries
      return index.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }))
    } catch (error) {
      console.error('Failed to load history index:', error)
      return []
    }
  }

  /**
   * Migrate old flat index format to new nested format
   */
  private async migrateAndGetIndex(): Promise<any[]> {
    try {
      // Get all individual extraction files
      const files = await fs.readdir(this.historyDir)
      const extractionFiles = files.filter(file => file.startsWith('extraction_') && file.endsWith('.json'))

      const newIndex: any[] = []

      for (const file of extractionFiles) {
        try {
          const filePath = path.join(this.historyDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const extraction = JSON.parse(content)

          // Create new index entry in correct format
          const indexEntry = {
            id: extraction.id,
            timestamp: extraction.timestamp,
            searchCriteria: {
              category: extraction.searchCriteria?.category || 'unknown',
              location: extraction.searchCriteria?.location || 'Unknown location',
              countryCode: extraction.searchCriteria?.countryCode || 'unknown'
            },
            statistics: {
              businessesFound: extraction.statistics?.businessesFound || extraction.results?.businesses?.length || 0,
              reviewsFound: extraction.statistics?.reviewsFound || extraction.results?.reviews?.length || 0,
              avgRating: extraction.statistics?.avgRating || 0,
              extractionTime: extraction.statistics?.extractionTime || 0
            },
            enrichmentHistory: extraction.enrichmentHistory || []
          }

          newIndex.push(indexEntry)
        } catch (fileError) {
          console.warn(`Failed to migrate extraction file ${file}:`, fileError)
        }
      }

      // Sort by timestamp (newest first)
      newIndex.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Save the new index
      await fs.writeFile(this.indexFile, JSON.stringify(newIndex, null, 2))
      console.log(`✅ Successfully migrated ${newIndex.length} extractions to new index format`)

      // Convert date strings back to Date objects
      return newIndex.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }))

    } catch (error) {
      console.error('Failed to migrate index:', error)
      return []
    }
  }

  /**
   * Update extraction with enrichment results
   */
  async updateEnrichment(
    id: string,
    enrichedBusinesses: Record<string, unknown>[],
    enrichmentStats: any
  ): Promise<void> {
    try {
      const extraction = await this.loadExtraction(id)
      if (!extraction) {
        console.warn(`Extraction ${id} not found for enrichment update`)
        return
      }

      // Update businesses with enriched data
      extraction.results.businesses = enrichedBusinesses

      // Add enrichment history entry
      if (!extraction.enrichmentHistory) {
        extraction.enrichmentHistory = []
      }

      extraction.enrichmentHistory.push({
        timestamp: new Date(),
        enrichedBusinesses: enrichmentStats.enrichedBusinesses || 0,
        phoneNumbers: enrichmentStats.phoneNumbers || 0,
        websites: enrichmentStats.websites || 0,
        emails: enrichmentStats.emails || 0
      })

      // Save updated extraction
      const dataFile = path.join(this.historyDir, `${id}.json`)
      await fs.writeFile(dataFile, JSON.stringify(extraction, null, 2))

      console.log(`📞 Enrichment data updated for extraction: ${id}`)

    } catch (error) {
      console.error(`Failed to update enrichment for ${id}:`, error)
    }
  }

  /**
   * Delete extraction from history
   */
  async deleteExtraction(id: string): Promise<void> {
    try {
      // Remove from index
      const index = await this.getIndex()
      const updatedIndex = index.filter(item => item.id !== id)
      await fs.writeFile(this.indexFile, JSON.stringify(updatedIndex, null, 2))

      // Delete data file
      const dataFile = path.join(this.historyDir, `${id}.json`)
      await fs.unlink(dataFile)

      console.log(`🗑️ Extraction deleted from history: ${id}`)
    } catch (error) {
      console.error(`Failed to delete extraction ${id}:`, error)
    }
  }

  /**
   * Search history by criteria
   */
  async searchHistory(filters: {
    category?: string
    location?: string
    countryCode?: string
    dateFrom?: Date
    dateTo?: Date
  }): Promise<any[]> {
    const index = await this.getIndex()

    return index.filter(item => {
      if (filters.category && !item.searchCriteria.category.toLowerCase().includes(filters.category.toLowerCase())) {
        return false
      }
      if (filters.location && !item.searchCriteria.location.toLowerCase().includes(filters.location.toLowerCase())) {
        return false
      }
      if (filters.countryCode && item.searchCriteria.countryCode !== filters.countryCode) {
        return false
      }
      if (filters.dateFrom && new Date(item.timestamp) < filters.dateFrom) {
        return false
      }
      if (filters.dateTo && new Date(item.timestamp) > filters.dateTo) {
        return false
      }
      return true
    })
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalExtractions: number
    totalSize: string
    oldestExtraction?: Date
    newestExtraction?: Date
  }> {
    try {
      const index = await this.getIndex()

      // Calculate total size
      const files = await fs.readdir(this.historyDir)
      let totalSize = 0
      for (const file of files) {
        if (file.endsWith('.json')) {
          const stats = await fs.stat(path.join(this.historyDir, file))
          totalSize += stats.size
        }
      }

      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2)

      return {
        totalExtractions: index.length,
        totalSize: `${sizeInMB} MB`,
        oldestExtraction: index.length > 0 ? new Date(Math.min(...index.map(item => new Date(item.timestamp).getTime()))) : undefined,
        newestExtraction: index.length > 0 ? new Date(Math.max(...index.map(item => new Date(item.timestamp).getTime()))) : undefined
      }
    } catch (error) {
      console.error('Failed to get storage stats:', error)
      return {
        totalExtractions: 0,
        totalSize: '0 MB'
      }
    }
  }
}