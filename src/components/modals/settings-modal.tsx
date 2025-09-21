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
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [ghlApiKey, setGhlApiKey] = useState('')
  const [ghlLocationId, setGhlLocationId] = useState('')
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

    if (savedApiKey) setGhlApiKey(savedApiKey)
    if (savedLocationId) setGhlLocationId(savedLocationId)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      // Validate API key format
      if (!ghlApiKey.trim()) {
        throw new Error('API Key is required')
      }

      if (!ghlLocationId.trim()) {
        throw new Error('Location ID is required')
      }

      // Save to localStorage
      localStorage.setItem('ghl_api_key', ghlApiKey.trim())
      localStorage.setItem('ghl_location_id', ghlLocationId.trim())

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
                  disabled={saving || !ghlApiKey.trim() || !ghlLocationId.trim()}
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