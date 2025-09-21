'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Users,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building,
  Send,
  CheckCircle,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EnrichedBusiness {
  title: string
  address: string
  phone?: string
  email?: string
  website?: string
  contactEnriched?: boolean
  enrichmentDate?: Date
}

interface LeadSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  enrichedBusinesses: EnrichedBusiness[]
}

export function LeadSelectionModal({ isOpen, onClose, enrichedBusinesses }: LeadSelectionModalProps) {
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter only businesses with contact information
  const availableLeads = enrichedBusinesses.filter(business =>
    business.contactEnriched && (business.phone || business.email || business.website)
  )

  useEffect(() => {
    if (isOpen) {
      setSelectedLeads(new Set())
      setSelectAll(false)
      setSent(false)
      setError(null)
    }
  }, [isOpen])

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedLeads(new Set(availableLeads.map((_, index) => index.toString())))
    } else {
      setSelectedLeads(new Set())
    }
  }

  const handleLeadSelect = (index: number, checked: boolean) => {
    const newSelected = new Set(selectedLeads)
    if (checked) {
      newSelected.add(index.toString())
    } else {
      newSelected.delete(index.toString())
    }
    setSelectedLeads(newSelected)
    setSelectAll(newSelected.size === availableLeads.length)
  }

  const handleSendToQuartzLeads = async () => {
    if (selectedLeads.size === 0) {
      setError('Please select at least one lead to send')
      return
    }

    // Check if Quartz Leads is configured
    const apiKey = localStorage.getItem('ghl_api_key')
    const locationId = localStorage.getItem('ghl_location_id')

    if (!apiKey || !locationId) {
      setError('Please configure your Quartz Leads API credentials in Settings first')
      return
    }

    setSending(true)
    setError(null)

    try {
      const selectedBusinesses = availableLeads.filter((_, index) =>
        selectedLeads.has(index.toString())
      )

      const response = await fetch('/api/quartz-leads/send-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contacts: selectedBusinesses.map(business => ({
            name: business.title,
            address: business.address,
            phone: business.phone,
            email: business.email,
            website: business.website,
            source: 'QuartzIQ Review Extraction'
          })),
          apiKey,
          locationId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send contacts to Quartz Leads')
      }

      setSent(true)
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send contacts')
    } finally {
      setSending(false)
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
            <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-primary" />
                  <div>
                    <h2 className="text-xl font-semibold">Send Leads to Quartz Leads</h2>
                    <p className="text-sm text-muted-foreground">
                      Select enriched contacts to send to your CRM
                    </p>
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

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {availableLeads.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-2">No Enriched Contacts Available</h3>
                    <p className="text-sm text-muted-foreground">
                      Run contact enrichment first to get phone numbers, emails, and websites
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Selection Controls */}
                    <div className="flex items-center justify-between mb-6 p-3 bg-muted rounded-lg">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded"
                        />
                        <span className="font-medium">
                          Select All ({selectedLeads.size}/{availableLeads.length} selected)
                        </span>
                      </label>
                      <Badge variant="secondary">
                        {availableLeads.length} leads available
                      </Badge>
                    </div>

                    {/* Leads List */}
                    <div className="space-y-3">
                      {availableLeads.map((business, index) => {
                        const isSelected = selectedLeads.has(index.toString())

                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card
                              className={cn(
                                "p-4 cursor-pointer transition-all duration-200",
                                isSelected
                                  ? 'ring-2 ring-primary bg-primary/5'
                                  : 'hover:bg-muted/50'
                              )}
                              onClick={() => handleLeadSelect(index, !isSelected)}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleLeadSelect(index, e.target.checked)}
                                  className="rounded mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <h3 className="font-medium text-foreground">{business.title}</h3>
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span className="truncate">{business.address}</span>
                                      </div>
                                    </div>
                                    <Badge variant="secondary" className="ml-2">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Enriched
                                    </Badge>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {business.phone && (
                                      <div className="flex items-center gap-1 text-xs bg-green-500/10 text-green-300 px-2 py-1 rounded">
                                        <Phone className="h-3 w-3" />
                                        {business.phone}
                                      </div>
                                    )}
                                    {business.email && (
                                      <div className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-300 px-2 py-1 rounded">
                                        <Mail className="h-3 w-3" />
                                        {business.email}
                                      </div>
                                    )}
                                    {business.website && (
                                      <div className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded">
                                        <Globe className="h-3 w-3" />
                                        Website
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {availableLeads.length > 0 && (
                <div className="border-t p-6">
                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Success Message */}
                  {sent && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2 inline" />
                      Successfully sent {selectedLeads.size} contacts to Quartz Leads!
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendToQuartzLeads}
                      disabled={sending || selectedLeads.size === 0 || sent}
                      className="flex-1"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : sent ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Sent!
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send to Quartz Leads ({selectedLeads.size})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}