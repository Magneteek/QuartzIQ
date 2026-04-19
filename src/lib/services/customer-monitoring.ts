/**
 * Customer Monitoring Service
 * Automatically monitors paying customers for new negative reviews
 */

import { Pool } from 'pg'
import { UniversalBusinessReviewExtractor } from '../extractor'
import { logger } from '../logger'

const monitoringLogger = logger.child({ module: 'customer-monitoring' })

interface MonitoringCustomer {
  business_id: string
  business_name: string
  place_id: string
  last_checked: Date | null
  frequency_hours: number
  lifecycle_stage: string
  monitoring_alert_threshold?: number
}

interface MonitoringResult {
  businessId: string
  businessName: string
  success: boolean
  reviewsFound: number
  newReviewsCount: number
  negativeReviewsFound: number
  alertsCreated: number
  scrapeCostUsd: number
  scrapeDurationMs: number
  error?: string
}

export class CustomerMonitoringService {
  private pool: Pool

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      database: process.env.POSTGRES_DATABASE,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    })
  }

  /**
   * Main monitoring function - checks all customers that need monitoring
   */
  async runMonitoringCycle(): Promise<MonitoringResult[]> {
    monitoringLogger.info('Starting customer monitoring cycle')

    try {
      // Get customers that need monitoring
      const customers = await this.getCustomersForMonitoring()

      if (customers.length === 0) {
        monitoringLogger.info('No customers need monitoring at this time')
        return []
      }

      monitoringLogger.info(`Found ${customers.length} customers needing monitoring`)

      // Monitor each customer
      const results: MonitoringResult[] = []
      for (const customer of customers) {
        try {
          const result = await this.monitorCustomer(customer)
          results.push(result)
        } catch (error) {
          monitoringLogger.error('Failed to monitor customer', {
            businessId: customer.business_id,
            businessName: customer.business_name,
            error: error instanceof Error ? error.message : String(error),
          })
          results.push({
            businessId: customer.business_id,
            businessName: customer.business_name,
            success: false,
            reviewsFound: 0,
            newReviewsCount: 0,
            negativeReviewsFound: 0,
            alertsCreated: 0,
            scrapeCostUsd: 0,
            scrapeDurationMs: 0,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // Log summary
      const successful = results.filter(r => r.success).length
      const totalAlerts = results.reduce((sum, r) => sum + r.alertsCreated, 0)
      const totalCost = results.reduce((sum, r) => sum + r.scrapeCostUsd, 0)

      monitoringLogger.info('Monitoring cycle complete', {
        totalCustomers: customers.length,
        successful,
        totalAlerts,
        totalCostUsd: totalCost.toFixed(4),
      })

      return results

    } catch (error) {
      monitoringLogger.error('Monitoring cycle failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Monitor a single customer for new negative reviews
   */
  async monitorCustomer(customer: MonitoringCustomer): Promise<MonitoringResult> {
    const startTime = Date.now()

    monitoringLogger.info('Monitoring customer', {
      businessId: customer.business_id,
      businessName: customer.business_name,
      lastChecked: customer.last_checked,
    })

    try {
      // Get business details
      const businessResult = await this.pool.query(
        'SELECT * FROM businesses WHERE id = $1',
        [customer.business_id]
      )

      if (businessResult.rows.length === 0) {
        throw new Error('Business not found')
      }

      const business = businessResult.rows[0]
      const alertThreshold = business.monitoring_alert_threshold || 3

      // Calculate date to scrape from (last check or 24 hours ago)
      const reviewsStartDate = customer.last_checked
        ? customer.last_checked.toISOString().split('T')[0]
        : this.getRelativeDate(24) // Default to last 24 hours if never checked

      // Extract reviews using the universal extractor
      const extractor = new UniversalBusinessReviewExtractor()

      const reviews = await extractor.extractReviewsFromBusiness(
        {
          title: business.name,
          address: business.address,
          totalScore: business.rating,
          reviewsCount: business.reviews_count,
          placeId: business.place_id,
          website: business.website,
          phone: business.phone,
        },
        {
          category: business.category || 'business',
          location: business.city || 'unknown',
          maxReviewsPerBusiness: 20, // Check up to 20 newest reviews
          maxStars: alertThreshold, // Only get reviews at or below threshold
          reviewsStartDate, // Only reviews since last check
        }
      )

      const reviewsFound = reviews.length

      // Filter for negative reviews with content (text OR images)
      const negativeReviews = reviews.filter(r => {
        const hasText = r.text && r.text.trim().length > 0
        const hasImages = (r.reviewImageUrls?.length || 0) > 0
        return r.stars <= alertThreshold && (hasText || hasImages)
      })

      // Store all fetched reviews in the reviews table (permanent record)
      await this.storeReviews(customer.business_id, reviews)

      // Create alerts for negative reviews
      const alertsCreated = await this.createAlertsForReviews(
        customer.business_id,
        negativeReviews,
        alertThreshold
      )

      // Calculate cost (Compass charges $0.50 per 1000 reviews)
      const scrapeCostUsd = (reviewsFound * 0.50) / 1000

      // Schedule next check
      await this.scheduleNextCheck(customer.business_id, customer.frequency_hours)

      // Save monitoring history
      await this.saveMonitoringHistory({
        businessId: customer.business_id,
        reviewsFound,
        newReviewsCount: reviewsFound,
        negativeReviewsFound: negativeReviews.length,
        alertsCreated,
        scrapeCostUsd,
        scrapeDurationMs: Date.now() - startTime,
        status: 'success',
      })

      monitoringLogger.info('Customer monitoring complete', {
        businessId: customer.business_id,
        reviewsFound,
        negativeReviewsFound: negativeReviews.length,
        alertsCreated,
        scrapeCostUsd: scrapeCostUsd.toFixed(4),
      })

      return {
        businessId: customer.business_id,
        businessName: customer.business_name,
        success: true,
        reviewsFound,
        newReviewsCount: reviewsFound,
        negativeReviewsFound: negativeReviews.length,
        alertsCreated,
        scrapeCostUsd,
        scrapeDurationMs: Date.now() - startTime,
      }

    } catch (error) {
      // Save failed monitoring attempt
      await this.saveMonitoringHistory({
        businessId: customer.business_id,
        reviewsFound: 0,
        newReviewsCount: 0,
        negativeReviewsFound: 0,
        alertsCreated: 0,
        scrapeCostUsd: 0,
        scrapeDurationMs: Date.now() - startTime,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * Get customers that need monitoring
   */
  private async getCustomersForMonitoring(): Promise<MonitoringCustomer[]> {
    const result = await this.pool.query<MonitoringCustomer>(
      'SELECT * FROM get_customers_for_monitoring()'
    )
    return result.rows
  }

  /**
   * Create alerts for negative reviews
   */
  private async createAlertsForReviews(
    businessId: string,
    reviews: any[],
    threshold: number
  ): Promise<number> {
    let alertsCreated = 0

    for (const review of reviews) {
      // Check if alert already exists for this review
      const existing = await this.pool.query(
        `SELECT id FROM customer_monitoring_alerts
         WHERE business_id = $1 AND review_text = $2 AND review_date = $3`,
        [businessId, review.text, review.publishedAtDate]
      )

      if (existing.rows.length > 0) {
        continue // Alert already exists
      }

      // Determine severity based on stars
      let severity = 'low'
      if (review.stars === 1) severity = 'critical'
      else if (review.stars === 2) severity = 'high'
      else if (review.stars === 3) severity = 'medium'

      // Create alert with new status field
      const alertResult = await this.pool.query(
        `INSERT INTO customer_monitoring_alerts (
          business_id, alert_type, severity,
          review_stars, review_text, review_date, reviewer_name,
          status, ghl_webhook_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', false)
        RETURNING id`,
        [
          businessId,
          'new_negative_review',
          severity,
          review.stars,
          review.text,
          review.publishedAtDate,
          review.name || null,
        ]
      )

      const alertId = alertResult.rows[0].id

      // Send alert to GoHighLevel
      try {
        // Extract image URLs from review
        const imageUrls = review.reviewImageUrls || []

        await this.sendAlertToGHL(businessId, {
          alertId,
          reviewStars: review.stars,
          reviewText: review.text || '',
          reviewDate: review.publishedAtDate,
          reviewerName: review.name,
          reviewUrl: review.url,
          reviewImages: imageUrls,
          severity,
        })

        // Mark webhook as sent
        await this.pool.query(
          `UPDATE customer_monitoring_alerts
           SET ghl_webhook_sent = true, ghl_webhook_sent_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [alertId]
        )

        monitoringLogger.info('Alert sent to GHL', {
          businessId,
          alertId,
          hasImages: imageUrls.length > 0,
          imageCount: imageUrls.length
        })
      } catch (ghlError) {
        monitoringLogger.error('Failed to send alert to GHL', {
          businessId,
          alertId,
          error: ghlError instanceof Error ? ghlError.message : String(ghlError),
        })
        // Don't fail the whole process if GHL notification fails
      }

      alertsCreated++
    }

    return alertsCreated
  }

  /**
   * Store scraped reviews in the reviews table for historical record
   */
  private async storeReviews(businessId: string, reviews: any[]): Promise<void> {
    if (!reviews.length) return

    for (const review of reviews) {
      try {
        const reviewHash = [
          review.name || '',
          review.text || review.reviewText || '',
          review.publishedAtDate || review.date || '',
        ].join('|')

        await this.pool.query(
          `INSERT INTO reviews (
            business_id, reviewer_name, rating, text,
            published_date, source, review_hash, raw_data
          ) VALUES ($1, $2, $3, $4, $5, 'monitoring', $6, $7::jsonb)
          ON CONFLICT (business_id, review_hash) DO NOTHING`,
          [
            businessId,
            review.name || null,
            review.stars || null,
            review.text || null,
            review.publishedAtDate ? new Date(review.publishedAtDate) : null,
            reviewHash,
            JSON.stringify(review),
          ]
        )
      } catch {
        // Non-fatal: don't fail the monitoring cycle if a review can't be stored
      }
    }
  }

  /**
   * Send alert to GoHighLevel when negative review detected
   */
  private async sendAlertToGHL(
    businessId: string,
    alert: {
      alertId: string
      reviewStars: number
      reviewText: string
      reviewDate: string
      reviewerName?: string
      reviewUrl?: string
      reviewImages?: string[]
      severity: string
    }
  ): Promise<void> {
    // Get business details
    const businessResult = await this.pool.query(
      'SELECT * FROM businesses WHERE id = $1',
      [businessId]
    )

    if (businessResult.rows.length === 0) {
      throw new Error('Business not found')
    }

    const business = businessResult.rows[0]

    // Get GHL webhook URL
    const ghlWebhookUrl = process.env.GHL_WEBHOOK_URL

    if (!ghlWebhookUrl) {
      monitoringLogger.warn('GHL_WEBHOOK_URL not configured, skipping notification')
      return
    }

    // Prepare webhook payload
    const webhookPayload = {
      // Alert metadata
      alert_id: alert.alertId,
      alert_type: 'negative_review',
      severity: alert.severity,
      detected_at: new Date().toISOString(),

      // Business information
      business_id: businessId,
      business_name: business.name || '',
      business_email: business.email || '',
      business_phone: business.phone || '',
      business_website: business.website || '',
      business_address: business.address || '',
      business_city: business.city || '',
      business_country: business.country_code || '',
      business_category: business.category || '',
      place_id: business.place_id || '',
      google_url: business.place_id ? `https://www.google.com/maps/place/?q=place_id:${business.place_id}` : '',

      // Review information
      review_rating: alert.reviewStars,
      review_text: alert.reviewText || '',
      reviewer_name: alert.reviewerName || 'Anonymous',
      review_date: alert.reviewDate ? new Date(alert.reviewDate).toISOString().split('T')[0] : '',
      review_url: alert.reviewUrl || '',
      review_images: alert.reviewImages || [],
      has_images: (alert.reviewImages?.length || 0) > 0,

      // Action URL
      action_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3069'}/dashboard/monitoring`,

      // Tags for automation filtering
      tags: [
        'Negative-Review-Alert',
        'Customer',
        `${alert.severity}-Severity`,
        `${alert.reviewStars}-Star-Review`,
        ...(alert.reviewImages?.length ? ['Has-Images'] : [])
      ].join(',')
    }

    // Send to GHL webhook
    const response = await fetch(ghlWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`GHL webhook error: ${response.status} - ${errorText}`)
    }

    monitoringLogger.info('Alert sent to GHL webhook successfully', {
      businessId,
      alertId: alert.alertId,
      severity: alert.severity,
      reviewStars: alert.reviewStars,
    })
  }

  /**
   * Create opportunity in GHL for negative review alert
   */
  private async createGHLOpportunity(
    contactId: string,
    business: any,
    alert: { reviewStars: number; reviewText: string; severity: string }
  ): Promise<void> {
    const ghlApiKey = process.env.GHL_API_KEY
    const pipelineId = process.env.GHL_PIPELINE_ID // Optional: specific pipeline for negative reviews

    if (!ghlApiKey) return

    const opportunityData = {
      contactId,
      name: `Negative Review Alert: ${business.name}`,
      status: 'open',
      monetaryValue: 0, // You can set a value if desired
      ...(pipelineId && { pipelineId }),
      customFields: {
        review_rating: `${alert.reviewStars} stars`,
        alert_severity: alert.severity,
      },
    }

    const response = await fetch('https://rest.gohighlevel.com/v1/opportunities/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(opportunityData),
    })

    if (!response.ok) {
      throw new Error(`Failed to create opportunity: ${response.status}`)
    }

    monitoringLogger.info('GHL opportunity created', { contactId, business: business.name })
  }

  /**
   * Schedule next monitoring check
   */
  private async scheduleNextCheck(
    businessId: string,
    frequencyHours: number
  ): Promise<void> {
    await this.pool.query(
      'SELECT schedule_next_monitoring_check($1, $2)',
      [businessId, frequencyHours]
    )
  }

  /**
   * Save monitoring history
   */
  private async saveMonitoringHistory(data: {
    businessId: string
    reviewsFound: number
    newReviewsCount: number
    negativeReviewsFound: number
    alertsCreated: number
    scrapeCostUsd: number
    scrapeDurationMs: number
    status: string
    errorMessage?: string
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO customer_monitoring_history (
        business_id, reviews_found, new_reviews_count, negative_reviews_found,
        alerts_created, scrape_cost_usd, scrape_duration_ms, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.businessId,
        data.reviewsFound,
        data.newReviewsCount,
        data.negativeReviewsFound,
        data.alertsCreated,
        data.scrapeCostUsd,
        data.scrapeDurationMs,
        data.status,
        data.errorMessage || null,
      ]
    )
  }

  /**
   * Get relative date string (e.g., "7 days" for 7 days ago)
   */
  private getRelativeDate(hours: number): string {
    if (hours < 48) {
      return `${hours} hours`
    }
    const days = Math.floor(hours / 24)
    return `${days} days`
  }

  /**
   * Enable monitoring for a customer
   */
  async enableMonitoring(
    businessId: string,
    frequencyHours: number = 24,
    alertThreshold: number = 3
  ): Promise<void> {
    await this.pool.query(
      `UPDATE businesses
       SET monitoring_enabled = TRUE,
           monitoring_frequency_hours = $2,
           monitoring_alert_threshold = $3,
           next_monitoring_check = NOW()
       WHERE id = $1`,
      [businessId, frequencyHours, alertThreshold]
    )

    monitoringLogger.info('Monitoring enabled', {
      businessId,
      frequencyHours,
      alertThreshold,
    })
  }

  /**
   * Disable monitoring for a customer
   */
  async disableMonitoring(businessId: string): Promise<void> {
    await this.pool.query(
      `UPDATE businesses
       SET monitoring_enabled = FALSE,
           next_monitoring_check = NULL
       WHERE id = $1`,
      [businessId]
    )

    monitoringLogger.info('Monitoring disabled', { businessId })
  }

  /**
   * Update customer lifecycle stage
   */
  async updateLifecycleStage(
    businessId: string,
    stage: 'prospect' | 'lead' | 'qualified' | 'customer' | 'churned',
    isPaying?: boolean,
    tier?: 'basic' | 'premium' | 'enterprise'
  ): Promise<void> {
    await this.pool.query(
      'SELECT update_customer_lifecycle($1, $2, $3, $4)',
      [businessId, stage, isPaying, tier]
    )

    monitoringLogger.info('Lifecycle stage updated', {
      businessId,
      stage,
      isPaying,
      tier,
    })
  }

  /**
   * Get monitoring stats
   */
  async getStats(): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM get_customer_monitoring_stats()'
    )
    return result.rows[0]
  }

  /**
   * Get unacknowledged alerts
   */
  async getUnacknowledgedAlerts(limit: number = 50): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT a.*, b.name as business_name, b.place_id
       FROM customer_monitoring_alerts a
       JOIN businesses b ON a.business_id = b.id
       WHERE a.acknowledged_at IS NULL
       ORDER BY a.detected_at DESC
       LIMIT $1`,
      [limit]
    )
    return result.rows
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    userId: string,
    actionTaken?: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE customer_monitoring_alerts
       SET acknowledged_at = NOW(),
           acknowledged_by = $2,
           action_taken = $3,
           action_date = NOW()
       WHERE id = $1`,
      [alertId, userId, actionTaken]
    )

    monitoringLogger.info('Alert acknowledged', {
      alertId,
      userId,
      actionTaken,
    })
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.pool.end()
  }
}

// Export singleton instance
export const customerMonitoringService = new CustomerMonitoringService()
