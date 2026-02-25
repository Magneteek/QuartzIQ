'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  X,
  Settings,
  CheckCircle,
  AlertCircle,
  Database,
  Trash2,
  Eye,
  Key,
  Zap,
  Users,
  Webhook,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { DatabaseStatusIndicator } from '@/components/database/database-status-indicator'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface APIStatus {
  name: string
  configured: boolean
  icon: any
  color: string
  description: string
  envVars: string[]
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Scraped businesses management state
  const [scrapedStats, setScrapedStats] = useState<any>(null)
  const [clearDays, setClearDays] = useState('90')
  const [clearing, setClearing] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [apiStatuses, setApiStatuses] = useState<APIStatus[]>([])

  // API endpoint selection
  const [apiEndpoint, setApiEndpoint] = useState<'standard' | 'optimized'>('optimized')

  useEffect(() => {
    if (isOpen) {
      loadSettings()
      loadScrapedStats()
      loadAPIStatus()
    }
  }, [isOpen])

  const loadSettings = () => {
    // Load API endpoint preference from localStorage
    const savedApiEndpoint = localStorage.getItem('api_endpoint') as 'standard' | 'optimized'
    if (savedApiEndpoint) setApiEndpoint(savedApiEndpoint)
  }

  const loadAPIStatus = async () => {
    setLoadingStatus(true)
    try {
      const response = await fetch('/api/settings/status')
      const data = await response.json()

      const statuses: APIStatus[] = [
        {
          name: 'GoHighLevel (Quartz Leads)',
          configured: data.ghl?.configured || false,
          icon: Zap,
          color: 'text-blue-400',
          description: 'CRM integration for lead management',
          envVars: ['GHL_API_KEY', 'GHL_LOCATION_ID']
        },
        {
          name: 'Apify',
          configured: data.apify?.configured || false,
          icon: Database,
          color: 'text-purple-400',
          description: 'Google Maps scraping and review extraction',
          envVars: ['APIFY_API_TOKEN']
        },
        {
          name: 'Apollo.io',
          configured: data.apollo?.configured || false,
          icon: Users,
          color: 'text-green-400',
          description: 'Contact enrichment (email & phone)',
          envVars: ['APOLLO_API_KEY']
        },
        {
          name: 'GHL Webhooks',
          configured: data.webhooks?.configured || false,
          icon: Webhook,
          color: 'text-orange-400',
          description: 'Inbound webhooks for automation',
          envVars: ['GHL_WEBHOOK_URL', 'GHL_WEBHOOK_SECRET']
        }
      ]

      setApiStatuses(statuses)
    } catch (error) {
      console.error('Failed to load API status:', error)
    } finally {
      setLoadingStatus(false)
    }
  }

  const loadScrapedStats = async () => {
    try {
      const response = await fetch('/api/scraped-businesses?stats=true')
      const data = await response.json()
      setScrapedStats(data.stats)
    } catch (error) {
      console.error('Failed to load scraped businesses stats:', error)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear ALL scraped business history? This cannot be undone.')) {
      return
    }

    setClearing(true)
    try {
      const response = await fetch('/api/scraped-businesses?all=true', {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadScrapedStats()
        alert('All scraped business history has been cleared')
      } else {
        throw new Error('Failed to clear history')
      }
    } catch (error) {
      alert('Failed to clear scraped businesses')
      console.error(error)
    } finally {
      setClearing(false)
    }
  }

  const handleClearOlderThan = async () => {
    const days = parseInt(clearDays, 10)
    if (isNaN(days) || days < 1) {
      alert('Please enter a valid number of days')
      return
    }

    if (!confirm(`Clear all businesses scraped more than ${days} days ago? This cannot be undone.`)) {
      return
    }

    setClearing(true)
    try {
      const response = await fetch(`/api/scraped-businesses?olderThan=${days}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        await loadScrapedStats()
        alert(`Removed ${data.removedCount} businesses older than ${days} days`)
      } else {
        throw new Error('Failed to clear history')
      }
    } catch (error) {
      alert('Failed to clear scraped businesses')
      console.error(error)
    } finally {
      setClearing(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between sticky top-0 bg-card z-10 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-primary" />
                  <div>
                    <h2 className="text-xl font-semibold">System Settings</h2>
                    <p className="text-xs text-muted-foreground">Configuration managed via environment variables</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* API Integrations Status */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    <h3 className="font-medium">API Integrations</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadAPIStatus}
                    disabled={loadingStatus}
                  >
                    <RefreshCw className={cn("h-4 w-4", loadingStatus && "animate-spin")} />
                  </Button>
                </div>

                {loadingStatus ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Loading API status...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {apiStatuses.map((api) => {
                      const Icon = api.icon
                      return (
                        <div
                          key={api.name}
                          className={cn(
                            "p-4 rounded-lg border",
                            api.configured
                              ? "bg-green-500/10 border-green-500/20"
                              : "bg-red-500/10 border-red-500/20"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={cn("h-5 w-5 mt-0.5", api.color)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium truncate">{api.name}</p>
                                {api.configured ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{api.description}</p>
                              <div className="flex flex-wrap gap-1">
                                {api.envVars.map((envVar) => (
                                  <Badge key={envVar} variant="outline" className="text-[10px] font-mono">
                                    {envVar}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Configuration Help */}
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-300">
                      <p className="font-medium mb-1">Configure via .env file:</p>
                      <p className="text-xs">
                        API keys are managed through environment variables. Update your <span className="font-mono">.env.local</span> file and restart the server to apply changes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t"></div>

              {/* API Endpoint Selection Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">API Endpoint</h3>
                  <Badge variant="outline" className="ml-auto">
                    Cost Optimization
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="api-endpoint">Extraction API</Label>
                    <select
                      id="api-endpoint"
                      value={apiEndpoint}
                      onChange={(e) => {
                        const value = e.target.value as 'standard' | 'optimized'
                        setApiEndpoint(value)
                        localStorage.setItem('api_endpoint', value)
                      }}
                      className="w-full p-2.5 rounded-md border bg-background text-sm"
                    >
                      <option value="standard">Standard API (No caching)</option>
                      <option value="optimized">Optimized API (Uses database cache) ⭐</option>
                    </select>
                  </div>

                  {/* API Status Card */}
                  {apiEndpoint === 'optimized' ? (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-500 mb-1">
                            Cost Optimization Enabled
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Using database cache to minimize Apify costs. Expected savings: 60-80%
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-500 mb-1">
                            No Cost Optimization
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Every search calls Apify directly. Switch to Optimized API to save money.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Database Status */}
                  <div className="space-y-2">
                    <Label>Database Cache Status</Label>
                    <DatabaseStatusIndicator />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t"></div>

              {/* Scraped Businesses Management Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Scraped Businesses History</h3>
                </div>

                {scrapedStats ? (
                  <div className="space-y-4">
                    {/* Stats Display */}
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Tracked:</span>
                        <Badge variant="secondary" className="text-base">
                          {scrapedStats.total} businesses
                        </Badge>
                      </div>

                      {scrapedStats.oldestScrape && scrapedStats.newestScrape && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Oldest: {new Date(scrapedStats.oldestScrape).toLocaleDateString()}</div>
                          <div>Newest: {new Date(scrapedStats.newestScrape).toLocaleDateString()}</div>
                        </div>
                      )}

                      {scrapedStats.byCategory && Object.keys(scrapedStats.byCategory).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          {Object.entries(scrapedStats.byCategory).map(([category, count]: [string, any]) => (
                            <Badge key={category} variant="outline" className="text-xs">
                              {category}: {count}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Clear Options */}
                    <div className="space-y-3">
                      {/* Clear Older Than */}
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="clear-days">Clear businesses older than (days)</Label>
                          <Input
                            id="clear-days"
                            type="number"
                            value={clearDays}
                            onChange={(e) => setClearDays(e.target.value)}
                            placeholder="90"
                            className="text-sm"
                            min="1"
                          />
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleClearOlderThan}
                          disabled={clearing || !clearDays}
                          className="text-orange-400 border-orange-500/40 hover:bg-orange-500/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear Old
                        </Button>
                      </div>

                      {/* Clear All */}
                      <Button
                        variant="outline"
                        onClick={handleClearAll}
                        disabled={clearing || scrapedStats.total === 0}
                        className="w-full text-red-400 border-red-500/40 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All History
                      </Button>
                    </div>

                    {/* Help Text */}
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                        <div className="text-sm text-yellow-300">
                          <p className="font-medium mb-1">About Deduplication:</p>
                          <p className="text-xs">
                            Businesses are automatically tracked after each extraction. This prevents re-scraping
                            the same businesses and wasting API credits. Clear old entries periodically to refresh your leads.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    Loading stats...
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={onClose}
                  className="min-w-[120px]"
                >
                  Close
                </Button>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
