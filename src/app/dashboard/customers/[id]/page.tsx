'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Mail, Phone, Globe, MapPin, Star, Bell, CheckCircle2, AlertCircle, Clock, Loader2, Save } from 'lucide-react'

export default function CustomerDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [formData, setFormData] = useState({
    customer_tier: 'basic',
    monitoring_enabled: true,
    monitoring_frequency_hours: 24,
    monitoring_alert_threshold: 3,
    notes: '',
  })

  useEffect(() => {
    if (id) fetchCustomerData()
  }, [id])

  const fetchCustomerData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/${id}`)
      if (!response.ok) throw new Error('Failed to fetch customer')

      const data = await response.json()
      setCustomer(data.customer)

      if (data.customer) {
        setFormData({
          customer_tier: data.customer.customer_tier,
          monitoring_enabled: data.customer.monitoring_enabled,
          monitoring_frequency_hours: data.customer.monitoring_frequency_hours,
          monitoring_alert_threshold: data.customer.monitoring_alert_threshold,
          notes: data.customer.notes || '',
        })
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
      setNotification({ type: 'error', message: 'Failed to load customer data' })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to save settings')

      setNotification({ type: 'success', message: 'Customer settings updated successfully' })
      fetchCustomerData()
    } catch (error) {
      console.error('Error saving:', error)
      setNotification({ type: 'error', message: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return <div className="text-center py-12">Customer not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/customers">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {customer.customer_tier} • Since {new Date(customer.customer_since).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="text-sm underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Rating</p>
              <p className="text-2xl font-bold">{parseFloat(customer.rating || 0).toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Alerts</p>
              <p className="text-2xl font-bold">{customer.unacknowledged_alerts || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Removed</p>
              <p className="text-2xl font-bold">{customer.total_removed_reviews || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Checks</p>
              <p className="text-2xl font-bold">{customer.total_checks || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
          <div className="space-y-3">
            {customer.first_name && customer.last_name && (
              <div className="flex items-center gap-3">
                <span className="text-gray-600 dark:text-gray-400 w-24">Contact:</span>
                <span>{customer.first_name} {customer.last_name}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 dark:text-gray-400 w-20">Email:</span>
                <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">{customer.email}</a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 dark:text-gray-400 w-20">Phone:</span>
                <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">{customer.phone}</a>
              </div>
            )}
            {customer.website && (
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 dark:text-gray-400 w-20">Website:</span>
                <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{customer.website}</a>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 dark:text-gray-400 w-20">Address:</span>
                <div>{customer.address}<br />{customer.city}, {customer.country_code}</div>
              </div>
            )}
          </div>
        </div>

        {/* Monitoring Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Monitoring Settings</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tier">Customer Tier</Label>
              <Select value={formData.customer_tier} onValueChange={(value) => setFormData({ ...formData, customer_tier: value })}>
                <SelectTrigger id="tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="monitoring_enabled"
                checked={formData.monitoring_enabled}
                onChange={(e) => setFormData({ ...formData, monitoring_enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="monitoring_enabled">Enable automatic monitoring</Label>
            </div>

            {formData.monitoring_enabled && (
              <>
                <div>
                  <Label htmlFor="frequency">Check Frequency (hours)</Label>
                  <Input
                    id="frequency"
                    type="number"
                    min="1"
                    max="168"
                    value={formData.monitoring_frequency_hours}
                    onChange={(e) => setFormData({ ...formData, monitoring_frequency_hours: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="threshold">Alert Threshold</Label>
                  <Select
                    value={formData.monitoring_alert_threshold.toString()}
                    onValueChange={(value) => setFormData({ ...formData, monitoring_alert_threshold: parseInt(value) })}
                  >
                    <SelectTrigger id="threshold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 star</SelectItem>
                      <SelectItem value="2">2 stars or below</SelectItem>
                      <SelectItem value="3">3 stars or below</SelectItem>
                      <SelectItem value="4">4 stars or below</SelectItem>
                      <SelectItem value="5">All reviews</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Internal notes..."
              />
            </div>

            <Button onClick={saveSettings} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
