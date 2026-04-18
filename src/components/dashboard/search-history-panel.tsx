'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, MapPin, Building, RefreshCw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchSession {
  id: string
  category: string
  location: string
  country_code: string | null
  businesses_found: number
  lat: number | null
  lng: number | null
  zoom: number | null
  created_at: string
}

interface SearchHistoryPanelProps {
  onReSearch?: (category: string, location: string, countryCode: string) => void
  refreshTrigger?: number
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function SearchHistoryPanel({ onReSearch, refreshTrigger }: SearchHistoryPanelProps) {
  const [sessions, setSessions] = useState<SearchSession[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/search-sessions?limit=20')
      const data = await res.json()
      if (data.success) setSessions(data.sessions)
    } catch (e) {
      console.error('Failed to load search sessions', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (refreshTrigger && refreshTrigger > 0) load() }, [refreshTrigger, load])

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Recent Searches</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </Button>
      </div>

      {sessions.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground px-2 py-1">No searches yet. Run your first extraction to see history here.</p>
      )}

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/50 group"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium truncate capitalize">{session.category}</span>
              </div>
              <div className="flex items-center gap-1 min-w-0 text-muted-foreground">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="text-xs truncate">{session.location}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {session.businesses_found > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 flex items-center gap-0.5">
                  <Building className="h-2.5 w-2.5" />
                  {session.businesses_found}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">{formatRelativeTime(session.created_at)}</span>
              {onReSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onReSearch(session.category, session.location, session.country_code || 'nl')}
                >
                  Re-run
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
