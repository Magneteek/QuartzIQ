/**
 * Scraped Business Tracker
 * Manages tracking of already-scraped businesses to prevent duplicates
 */

import fs from 'fs/promises'
import path from 'path'

export interface ScrapedBusiness {
  placeId: string
  businessName: string
  address: string
  firstScraped: string // ISO date string
  category: string
  location: string
}

export interface ScrapedBusinessesMap {
  [placeId: string]: Omit<ScrapedBusiness, 'placeId'>
}

export class ScrapedBusinessTracker {
  private storageFile: string

  constructor() {
    this.storageFile = path.join(process.cwd(), 'data', 'scraped-businesses.json')
  }

  /**
   * Load all scraped businesses from storage
   */
  async load(): Promise<ScrapedBusinessesMap> {
    try {
      const content = await fs.readFile(this.storageFile, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.warn('Failed to load scraped businesses, returning empty map:', error)
      return {}
    }
  }

  /**
   * Save scraped businesses to storage
   */
  async save(businesses: ScrapedBusinessesMap): Promise<void> {
    try {
      await fs.writeFile(this.storageFile, JSON.stringify(businesses, null, 2))
    } catch (error) {
      console.error('Failed to save scraped businesses:', error)
      throw error
    }
  }

  /**
   * Check if a business has been scraped before
   */
  async isScraped(placeId: string): Promise<boolean> {
    const businesses = await this.load()
    return placeId in businesses
  }

  /**
   * Get details of a scraped business
   */
  async getDetails(placeId: string): Promise<ScrapedBusiness | null> {
    const businesses = await this.load()
    const details = businesses[placeId]
    if (!details) return null

    return {
      placeId,
      ...details
    }
  }

  /**
   * Add businesses to scraped list
   * Returns count of newly added businesses (skips duplicates)
   */
  async addBusinesses(newBusinesses: ScrapedBusiness[]): Promise<number> {
    const businesses = await this.load()
    let addedCount = 0

    for (const business of newBusinesses) {
      if (!businesses[business.placeId]) {
        businesses[business.placeId] = {
          businessName: business.businessName,
          address: business.address,
          firstScraped: business.firstScraped,
          category: business.category,
          location: business.location
        }
        addedCount++
      }
    }

    await this.save(businesses)
    return addedCount
  }

  /**
   * Check multiple businesses and mark which are new vs already scraped
   */
  async checkBusinesses(businesses: any[]): Promise<Array<any & { isNew: boolean; alreadyScraped: boolean; previouslyScrapedDate?: string }>> {
    const scrapedMap = await this.load()

    return businesses.map(business => {
      const placeId = business.placeId
      const isScraped = placeId in scrapedMap

      return {
        ...business,
        isNew: !isScraped,
        alreadyScraped: isScraped,
        previouslyScrapedDate: isScraped ? scrapedMap[placeId].firstScraped : undefined
      }
    })
  }

  /**
   * Get statistics about scraped businesses
   */
  async getStats(): Promise<{
    total: number
    byCategory: Record<string, number>
    byLocation: Record<string, number>
    oldestScrape?: string
    newestScrape?: string
  }> {
    const businesses = await this.load()
    const entries = Object.values(businesses)

    const byCategory: Record<string, number> = {}
    const byLocation: Record<string, number> = {}
    let oldestScrape: string | undefined
    let newestScrape: string | undefined

    for (const business of entries) {
      // Count by category
      byCategory[business.category] = (byCategory[business.category] || 0) + 1

      // Count by location
      byLocation[business.location] = (byLocation[business.location] || 0) + 1

      // Track oldest and newest
      if (!oldestScrape || business.firstScraped < oldestScrape) {
        oldestScrape = business.firstScraped
      }
      if (!newestScrape || business.firstScraped > newestScrape) {
        newestScrape = business.firstScraped
      }
    }

    return {
      total: entries.length,
      byCategory,
      byLocation,
      oldestScrape,
      newestScrape
    }
  }

  /**
   * Clear all scraped businesses (with optional confirmation)
   */
  async clearAll(): Promise<void> {
    await this.save({})
    console.log('✅ All scraped businesses cleared')
  }

  /**
   * Remove businesses older than specified days
   */
  async clearOlderThan(days: number): Promise<number> {
    const businesses = await this.load()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffISO = cutoffDate.toISOString()

    let removedCount = 0
    const filtered: ScrapedBusinessesMap = {}

    for (const [placeId, details] of Object.entries(businesses)) {
      if (details.firstScraped >= cutoffISO) {
        filtered[placeId] = details
      } else {
        removedCount++
      }
    }

    await this.save(filtered)
    console.log(`✅ Removed ${removedCount} businesses older than ${days} days`)
    return removedCount
  }
}

// Export singleton instance
export const scrapedBusinessTracker = new ScrapedBusinessTracker()
