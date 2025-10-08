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
  Save,
  Key,
  CheckCircle,
  AlertCircle,
  Database
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [ghlApiKey, setGhlApiKey] = useState('')
  const [ghlLocationId, setGhlLocationId] = useState('')
  const [airtableApiKey, setAirtableApiKey] = useState('')
  const [airtableBaseId, setAirtableBaseId] = useState('')
  const [airtableTableName, setAirtableTableName] = useState('Leads')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = () => {
    // Load from localStorage
    const savedApiKey = localStorage.getItem('ghl_api_key')
    const savedLocationId = localStorage.getItem('ghl_location_id')
    const savedAirtableApiKey = localStorage.getItem('airtable_api_key')
    const savedAirtableBaseId = localStorage.getItem('airtable_base_id')
    const savedAirtableTableName = localStorage.getItem('airtable_table_name')

    if (savedApiKey) setGhlApiKey(savedApiKey)
    if (savedLocationId) setGhlLocationId(savedLocationId)
    if (savedAirtableApiKey) setAirtableApiKey(savedAirtableApiKey)
    if (savedAirtableBaseId) setAirtableBaseId(savedAirtableBaseId)
    if (savedAirtableTableName) setAirtableTableName(savedAirtableTableName)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      // Validate Quartz Leads credentials if provided
      if (ghlApiKey.trim() && !ghlLocationId.trim()) {
        throw new Error('Quartz Leads: Location ID is required when API Key is provided')
      }
      if (!ghlApiKey.trim() && ghlLocationId.trim()) {
        throw new Error('Quartz Leads: API Key is required when Location ID is provided')
      }

      // Validate Airtable credentials if provided
      if (airtableApiKey.trim() && !airtableBaseId.trim()) {
        throw new Error('Airtable: Base ID is required when API Key is provided')
      }
      if (!airtableApiKey.trim() && airtableBaseId.trim()) {
        throw new Error('Airtable: API Key is required when Base ID is provided')
      }

      // At least one CRM must be configured
      if (!ghlApiKey.trim() && !airtableApiKey.trim()) {
        throw new Error('Please configure at least one CRM integration')
      }

      // Save to localStorage
      if (ghlApiKey.trim()) {
        localStorage.setItem('ghl_api_key', ghlApiKey.trim())
        localStorage.setItem('ghl_location_id', ghlLocationId.trim())
      }

      if (airtableApiKey.trim()) {
        localStorage.setItem('airtable_api_key', airtableApiKey.trim())
        localStorage.setItem('airtable_base_id', airtableBaseId.trim())
        localStorage.setItem('airtable_table_name', airtableTableName.trim() || 'Leads')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    // TODO: Implement API connection test
    console.log('Testing GoHighLevel connection...')
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
            <Card className="w-full max-w-md p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-semibold">Settings</h2>
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

              {/* Quartz Leads Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Quartz Leads Integration</h3>
                </div>

                <div className="space-y-4">
                  {/* API Key Input */}
                  <div className="space-y-2">
                    <Label htmlFor="ghl-api-key">API Key</Label>
                    <Input
                      id="ghl-api-key"
                      type="password"
                      placeholder="Enter your Quartz Leads API key"
                      value={ghlApiKey}
                      onChange={(e) => setGhlApiKey(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Location ID Input */}
                  <div className="space-y-2">
                    <Label htmlFor="ghl-location-id">Location ID</Label>
                    <Input
                      id="ghl-location-id"
                      placeholder="Enter your Quartz Leads Location ID"
                      value={ghlLocationId}
                      onChange={(e) => setGhlLocationId(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Help Text */}
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-300">
                      <p className="font-medium mb-1">How to get your API credentials:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Go to Quartz Leads Settings → Integrations</li>
                        <li>Create a new API key with contact permissions</li>
                        <li>Copy your Location ID from the URL or settings</li>
                      </ol>
                    </div>
                  </div>
                </div>

              </div>

              {/* Divider */}
              <div className="border-t border-white/10"></div>

              {/* Airtable Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Airtable Integration</h3>
                </div>

                <div className="space-y-4">
                  {/* API Key Input */}
                  <div className="space-y-2">
                    <Label htmlFor="airtable-api-key">API Key</Label>
                    <Input
                      id="airtable-api-key"
                      type="password"
                      placeholder="Enter your Airtable API key"
                      value={airtableApiKey}
                      onChange={(e) => setAirtableApiKey(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Base ID Input */}
                  <div className="space-y-2">
                    <Label htmlFor="airtable-base-id">Base ID</Label>
                    <Input
                      id="airtable-base-id"
                      placeholder="appXXXXXXXXXXXXXX"
                      value={airtableBaseId}
                      onChange={(e) => setAirtableBaseId(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Table Name Input */}
                  <div className="space-y-2">
                    <Label htmlFor="airtable-table-name">Table Name (Optional)</Label>
                    <Input
                      id="airtable-table-name"
                      placeholder="Leads"
                      value={airtableTableName}
                      onChange={(e) => setAirtableTableName(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Help Text */}
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-purple-400 mt-0.5" />
                    <div className="text-sm text-purple-300">
                      <p className="font-medium mb-1">How to get your Airtable credentials:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Go to <span className="font-mono">airtable.com/create/tokens</span></li>
                        <li>Create token with <span className="font-mono">data.records:read</span> and <span className="font-mono">write</span> scopes</li>
                        <li>Find Base ID at <span className="font-mono">airtable.com/api</span> (starts with <span className="font-mono">app</span>)</li>
                        <li>Table name defaults to "Leads" if not specified</li>
                      </ol>
                    </div>
                  </div>
                </div>

              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || (!ghlApiKey.trim() && !airtableApiKey.trim())}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                      />
                      Saving...
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}