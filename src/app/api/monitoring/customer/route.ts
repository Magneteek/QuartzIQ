/**
 * API Route: Manage Customer Monitoring
 * POST /api/monitoring/customer
 * Enable monitoring, update lifecycle stage, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { customerMonitoringService } from '@/lib/services/customer-monitoring'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, businessId, ...params } = body

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'enable_monitoring':
        await customerMonitoringService.enableMonitoring(
          businessId,
          params.frequencyHours || 24,
          params.alertThreshold || 3
        )
        return NextResponse.json({
          success: true,
          message: 'Monitoring enabled',
        })

      case 'disable_monitoring':
        await customerMonitoringService.disableMonitoring(businessId)
        return NextResponse.json({
          success: true,
          message: 'Monitoring disabled',
        })

      case 'update_lifecycle':
        if (!params.stage) {
          return NextResponse.json(
            { success: false, error: 'stage is required' },
            { status: 400 }
          )
        }
        await customerMonitoringService.updateLifecycleStage(
          businessId,
          params.stage,
          params.isPaying,
          params.tier
        )
        return NextResponse.json({
          success: true,
          message: 'Lifecycle stage updated',
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Customer management failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
