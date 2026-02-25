/**
 * Apify Status Tracker
 * Provides real-time status updates and logs from Apify actor runs
 */

const APIFY_API_BASE = 'https://api.apify.com/v2'
const APIFY_TOKEN = process.env.APIFY_API_TOKEN

export interface ApifyRunStatus {
  id: string
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED'
  startedAt: string
  finishedAt?: string
  defaultDatasetId: string
  stats: {
    inputBodyLen: number
    restartCount: number
    resurrectCount: number
    memAvgBytes: number
    memMaxBytes: number
    memCurrentBytes: number
    cpuAvgUsage: number
    cpuMaxUsage: number
    cpuCurrentUsage: number
    netRxBytes: number
    netTxBytes: number
    durationMillis: number
    runTimeSecs: number
    metamorph: number
    computeUnits: number
  }
  options?: {
    build: string
    timeoutSecs: number
    memoryMbytes: number
  }
}

export interface ApifyDatasetStats {
  itemCount: number
  cleanItemCount: number
}

export interface RealTimeProgress {
  // Run status
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED'

  // Real counts
  businessesFound: number
  reviewsExtracted: number

  // Time tracking
  elapsedSeconds: number
  estimatedSecondsRemaining: number | null

  // Progress percentage (0-100)
  progressPercent: number

  // Cost estimate
  costEstimate: number
  computeUnits: number

  // Current step message
  stepMessage: string
}

export class ApifyStatusTracker {
  private runId: string
  private datasetId: string | null = null
  private startTime: Date
  private targetBusinessCount: number
  private lastItemCount: number = 0
  private lastCheckTime: Date

  constructor(runId: string, targetBusinessCount: number) {
    this.runId = runId
    this.targetBusinessCount = targetBusinessCount
    this.startTime = new Date()
    this.lastCheckTime = new Date()
  }

  /**
   * Get current run status from Apify
   */
  async getRunStatus(): Promise<ApifyRunStatus | null> {
    try {
      const response = await fetch(`${APIFY_API_BASE}/actor-runs/${this.runId}`, {
        headers: {
          'Authorization': `Bearer ${APIFY_TOKEN}`
        }
      })

      if (!response.ok) {
        console.error(`Failed to get run status: ${response.status}`)
        return null
      }

      const data = await response.json()

      // Cache dataset ID for future use
      if (data.data.defaultDatasetId) {
        this.datasetId = data.data.defaultDatasetId
      }

      return data.data
    } catch (error) {
      console.error('Error fetching run status:', error)
      return null
    }
  }

  /**
   * Get current dataset item count
   */
  async getDatasetCount(): Promise<number> {
    if (!this.datasetId) {
      // Try to get run status first to get dataset ID
      const status = await this.getRunStatus()
      if (!status?.defaultDatasetId) {
        return 0
      }
      this.datasetId = status.defaultDatasetId
    }

    try {
      const response = await fetch(`${APIFY_API_BASE}/datasets/${this.datasetId}`, {
        headers: {
          'Authorization': `Bearer ${APIFY_TOKEN}`
        }
      })

      if (!response.ok) {
        console.error(`Failed to get dataset: ${response.status}`)
        return 0
      }

      const data = await response.json()
      return data.data.itemCount || 0
    } catch (error) {
      console.error('Error fetching dataset count:', error)
      return 0
    }
  }

  /**
   * Get real-time Apify logs
   */
  async getLogs(): Promise<string | null> {
    try {
      const response = await fetch(`${APIFY_API_BASE}/actor-runs/${this.runId}/log`, {
        headers: {
          'Authorization': `Bearer ${APIFY_TOKEN}`
        }
      })

      if (!response.ok) {
        return null
      }

      return await response.text()
    } catch (error) {
      console.error('Error fetching logs:', error)
      return null
    }
  }

  /**
   * Calculate real-time progress with actual data
   */
  async getRealTimeProgress(): Promise<RealTimeProgress> {
    const runStatus = await this.getRunStatus()
    const itemCount = await this.getDatasetCount()

    // Calculate elapsed time
    const now = new Date()
    const elapsedMs = now.getTime() - this.startTime.getTime()
    const elapsedSeconds = Math.floor(elapsedMs / 1000)

    // Calculate rate and estimate remaining time
    let estimatedSecondsRemaining: number | null = null
    let progressPercent = 0

    if (itemCount > 0 && this.targetBusinessCount > 0) {
      progressPercent = Math.min(95, Math.floor((itemCount / this.targetBusinessCount) * 100))

      // Calculate rate (items per second)
      const rate = itemCount / elapsedSeconds
      if (rate > 0 && itemCount < this.targetBusinessCount) {
        const remainingItems = this.targetBusinessCount - itemCount
        estimatedSecondsRemaining = Math.ceil(remainingItems / rate)
      }
    } else if (runStatus?.status === 'READY') {
      progressPercent = 5
    } else if (runStatus?.status === 'RUNNING') {
      progressPercent = Math.max(10, progressPercent)
    }

    // Mark as complete if succeeded
    if (runStatus?.status === 'SUCCEEDED' || runStatus?.status === 'ABORTED') {
      progressPercent = 100
      estimatedSecondsRemaining = 0
    }

    // Calculate cost (Apify charges ~$0.25 per compute unit)
    const computeUnits = runStatus?.stats?.computeUnits || 0
    const costEstimate = computeUnits * 0.25

    // Generate step message
    let stepMessage = 'Initializing extraction...'
    if (runStatus) {
      switch (runStatus.status) {
        case 'READY':
          stepMessage = '⏳ Starting Apify crawler...'
          break
        case 'RUNNING':
          if (itemCount === 0) {
            stepMessage = '🔍 Searching Google Maps...'
          } else {
            stepMessage = `🔍 Scraping businesses... (${itemCount} found)`
          }
          break
        case 'SUCCEEDED':
          stepMessage = `✅ Extraction complete! Found ${itemCount} businesses`
          break
        case 'FAILED':
          stepMessage = '❌ Extraction failed'
          break
        case 'TIMED-OUT':
          stepMessage = '⏱️ Extraction timed out'
          break
        case 'ABORTED':
          stepMessage = `🛑 Stopped by user (${itemCount} businesses found)`
          break
      }
    }

    // Update tracking
    this.lastItemCount = itemCount
    this.lastCheckTime = now

    return {
      status: runStatus?.status || 'READY',
      businessesFound: itemCount,
      reviewsExtracted: 0, // Will be calculated from dataset items
      elapsedSeconds,
      estimatedSecondsRemaining,
      progressPercent,
      costEstimate,
      computeUnits,
      stepMessage
    }
  }

  /**
   * Abort the Apify run
   */
  async abortRun(): Promise<boolean> {
    try {
      const response = await fetch(`${APIFY_API_BASE}/actor-runs/${this.runId}/abort`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${APIFY_TOKEN}`
        }
      })

      return response.ok
    } catch (error) {
      console.error('Error aborting run:', error)
      return false
    }
  }
}
