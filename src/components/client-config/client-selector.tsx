'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings, CheckCircle, AlertCircle, Building } from 'lucide-react'

interface ClientConfig {
  clientId: string
  clientName: string
  hasApiKey: boolean
  hasLocationId: boolean
  customFields?: { [key: string]: string }
  settings?: {
    autoCreateContacts: boolean
    includeReviewText: boolean
    tagReviewType: boolean
  }
}

interface ClientSelectorProps {
  onClientSelect: (clientId: string) => void
  selectedClientId: string
}

export function ClientSelector({ onClientSelect, selectedClientId }: ClientSelectorProps) {
  const [clients, setClients] = useState<ClientConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [testingConnection, setTestingConnection] = useState(false)

  useEffect(() => {
    loadClientConfigs()
  }, [])

  const loadClientConfigs = async () => {
    try {
      // For now, just load the default client
      // In production, this would load all client configs from database
      const response = await fetch('/api/client-config?clientId=default')
      const data = await response.json()

      if (data.success) {
        setClients([data.data])
      }
    } catch (error) {
      console.error('Failed to load client configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async (clientId: string) => {
    setTestingConnection(true)
    try {
      const response = await fetch('/api/client-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          clientId
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('✅ GHL connection successful!')
      } else {
        alert('❌ GHL connection failed: ' + data.error)
      }
    } catch (error) {
      alert('❌ Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  const selectedClient = clients.find(c => c.clientId === selectedClientId)

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center space-x-2">
          <Building className="h-4 w-4 animate-pulse" />
          <span>Loading client configurations...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Building className="h-5 w-5" />
          <h3 className="font-semibold">Client Configuration</h3>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadClientConfigs()}>
          <Settings className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Select Client:</label>
          <Select value={selectedClientId} onValueChange={onClientSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose client configuration" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.clientId} value={client.clientId}>
                  <div className="flex items-center space-x-2">
                    <span>{client.clientName}</span>
                    {client.hasApiKey && client.hasLocationId ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClient && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium">{selectedClient.clientName}</div>
                <div className="text-sm text-muted-foreground">
                  API: {selectedClient.hasApiKey ? '✅ Configured' : '❌ Missing'} |
                  Location: {selectedClient.hasLocationId ? '✅ Configured' : '❌ Missing'}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testConnection(selectedClient.clientId)}
                disabled={testingConnection || !selectedClient.hasApiKey || !selectedClient.hasLocationId}
              >
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>

            {selectedClient.settings && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Settings:</div>
                <div>• Auto-create contacts: {selectedClient.settings.autoCreateContacts ? 'Yes' : 'No'}</div>
                <div>• Include review text: {selectedClient.settings.includeReviewText ? 'Yes' : 'No'}</div>
                <div>• Tag review type: {selectedClient.settings.tagReviewType ? 'Yes' : 'No'}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}