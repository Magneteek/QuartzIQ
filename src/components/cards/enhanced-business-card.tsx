'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Star,
  MapPin,
  ExternalLink,
  Phone,
  Globe,
  Mail,
  Calendar,
  Award,
  User,
  Crown,
  Eye,
  Sparkles,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface BusinessCardProps {
  business: {
    title: string
    address: string
    totalScore: number
    reviewsCount: number
    url: string
    phone?: string
    website?: string
    email?: string
    contactEnriched?: boolean
    enrichmentDate?: Date
    placeId?: string
    // Owner/Management Information
    ownerFirstName?: string
    ownerLastName?: string
    ownerTitle?: string
    ownerEmail?: string
    ownerEmailGenerated?: boolean
    managementTeam?: Array<{
      firstName: string
      lastName: string
      title: string
      email?: string
    }>
    leadQuality?: {
      score: number
      tier: string
      tierColor: string
      tierBg: string
      factors: string[]
      reviewCount: number
      rating: string
      recentActivityRate: number
      avgTextLength: number
    }
  }
  searchCriteria?: Record<string, unknown>
  index?: number
  isSelected?: boolean
  onToggleSelect?: () => void
}

export function EnhancedBusinessCard({
  business,
  searchCriteria,
  index = 0,
  isSelected = false,
  onToggleSelect
}: BusinessCardProps) {
  // Extract and type searchCriteria values
  const searchQuery = searchCriteria?.query ? String(searchCriteria.query) : null
  const searchLocation = typeof searchCriteria?.location === 'string' ? searchCriteria.location : null

  const [isScraped, setIsScraped] = useState<boolean | null>(null)
  const [scrapedDate, setScrapedDate] = useState<string | null>(null)
  const [crawlInfo, setCrawlInfo] = useState<{
    lastScrapedAt: string | null
    scrapeCount: number
    daysSinceLastCrawl: number | null
    isFresh: boolean
    isStale: boolean
  } | null>(null)

  useEffect(() => {
    // Check if this business has been scraped before
    if (business.placeId) {
      fetch(`/api/scraped-businesses?check=${business.placeId}`)
        .then(res => res.json())
        .then(data => {
          if (data.results && business.placeId && data.results[business.placeId]) {
            setIsScraped(true)
          } else {
            setIsScraped(false)
          }
        })
        .catch(error => {
          console.error('Failed to check scraped status:', error)
          setIsScraped(false)
        })
    }
  }, [business.placeId])

  // Fetch crawl tracking information
  useEffect(() => {
    if (business.placeId) {
      const placeId = business.placeId
      fetch(`/api/crawl/info?placeIds=${placeId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.crawlInfo && data.crawlInfo[placeId]) {
            setCrawlInfo(data.crawlInfo[placeId])
          }
        })
        .catch(error => {
          console.error('Failed to fetch crawl info:', error)
        })
    }
  }, [business.placeId])

  const getStarRating = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.1 }}
      >
        <Star
          className={cn(
            "h-4 w-4 transition-colors duration-200",
            i < Math.floor(rating)
              ? 'text-primary fill-current'
              : 'text-gray-600'
          )}
        />
      </motion.div>
    ))
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'bg-green-500/20 text-green-300 border-green-500/30'
    if (rating >= 4.0) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
    if (rating >= 3.5) return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    return 'bg-red-500/20 text-red-300 border-red-500/30'
  }


  // Contact fields with unified primary color styling
  const contactFields = [
    { value: business.phone, icon: Phone, label: 'Phone', color: 'text-primary' },
    { value: business.website, icon: Globe, label: 'Website', color: 'text-primary' },
    { value: business.email, icon: Mail, label: 'Email', color: 'text-primary' }
  ].filter(field => field.value)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 300 }}
      className="relative"
    >
      <Card
        className={cn(
          "cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden relative",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
        onClick={(e) => {
          // Allow selection only if clicking outside of action buttons
          const target = e.target as HTMLElement
          if (!target.closest('button') && !target.closest('[role="checkbox"]')) {
            onToggleSelect?.()
          }
        }}
      >
        {/* Checkbox Selection */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-3 left-3 z-10"
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => {
              console.log('Checkbox clicked, isSelected:', isSelected, 'new checked:', checked)
              onToggleSelect?.()
            }}
            onClick={(e) => {
              e.stopPropagation()
              console.log('Checkbox onClick, about to call onToggleSelect')
            }}
            className="h-5 w-5 bg-white/90 backdrop-blur-sm border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </motion.div>

        {/* Selection Indicator (Visual Feedback) */}
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-3 right-3 z-10 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-3 h-3 bg-white rounded-full"
            />
          </motion.div>
        )}

        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1 pl-10 pr-2">
              <h3 className="font-semibold text-lg leading-tight line-clamp-2 text-foreground">
                {business.title}
              </h3>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="line-clamp-1">{business.address}</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <Badge className={cn("text-xs font-medium", getRatingColor(parseFloat(String(business.totalScore || 0))))}>
                {business.totalScore ? parseFloat(String(business.totalScore)).toFixed(1) : 'N/A'}
              </Badge>

              {/* NEW/SEEN Badge */}
              {isScraped !== null && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {isScraped === false ? (
                    <Badge className="text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/40 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      NEW
                    </Badge>
                  ) : (
                    <Badge className="text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/40 flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      SEEN
                    </Badge>
                  )}
                </motion.div>
              )}

              {/* Last Crawl Info */}
              {crawlInfo?.lastScrapedAt && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 }}
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs cursor-help flex items-center gap-1",
                            crawlInfo.isFresh && "border-green-500/40 text-green-400 bg-green-500/10",
                            !crawlInfo.isFresh && !crawlInfo.isStale && "border-blue-500/40 text-blue-400 bg-blue-500/10",
                            crawlInfo.isStale && "border-orange-500/40 text-orange-400 bg-orange-500/10"
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(crawlInfo.lastScrapedAt), { addSuffix: true })}
                        </Badge>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="bg-card border border-border">
                      <div className="space-y-1.5 text-xs">
                        <div className="font-semibold text-foreground border-b border-border pb-1">
                          Crawl History
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Total Crawls:</span>
                          <span className="font-medium text-foreground flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            {crawlInfo.scrapeCount}x
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Last Crawled:</span>
                          <span className="font-medium text-foreground">
                            {crawlInfo.daysSinceLastCrawl} day{crawlInfo.daysSinceLastCrawl !== 1 ? 's' : ''} ago
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Status:</span>
                          <span className={cn(
                            "font-medium flex items-center gap-1",
                            crawlInfo.isFresh && "text-green-400",
                            !crawlInfo.isFresh && !crawlInfo.isStale && "text-blue-400",
                            crawlInfo.isStale && "text-orange-400"
                          )}>
                            {crawlInfo.isFresh && "Fresh"}
                            {!crawlInfo.isFresh && !crawlInfo.isStale && "Active"}
                            {crawlInfo.isStale && (
                              <>
                                <AlertCircle className="h-3 w-3" />
                                Stale
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Lead Quality Score */}
              {business.leadQuality && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-end gap-1"
                >
                  <Badge className={cn("text-xs font-bold flex items-center gap-1", business.leadQuality.tierBg)}>
                    <Award className="h-3 w-3" />
                    {business.leadQuality.tier}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {business.leadQuality.score}/100
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Rating & Reviews Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {getStarRating(parseFloat(String(business.totalScore || 0)))}
              </div>

              <div className="text-sm text-muted-foreground">
                {Number(business.reviewsCount || 0).toLocaleString()} reviews
              </div>
            </div>

            {/* Lead Quality Details */}
            {business.leadQuality && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Award className={cn("h-4 w-4", business.leadQuality.tierColor)} />
                  <span className="text-xs font-medium">
                    Lead Quality: {business.leadQuality.tier} ({business.leadQuality.score}/100)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reviews:</span>
                    <span className="font-medium">{business.leadQuality.reviewCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rating:</span>
                    <span className="font-medium">{business.leadQuality.rating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Activity:</span>
                    <span className="font-medium">{business.leadQuality.recentActivityRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quality:</span>
                    <span className="font-medium">{business.leadQuality.avgTextLength} chars</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Contact Enrichment Status */}
            {business.contactEnriched && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 border border-green-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-green-400">Contact Data Available</span>
                  {business.enrichmentDate && (
                    <span className="text-xs text-muted-foreground">
                      • {new Date(business.enrichmentDate).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {contactFields.length > 0 && (
                  <div className="grid grid-cols-1 gap-2">
                    {contactFields.map((field, idx) => (
                      <motion.div
                        key={field.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center gap-2 text-xs"
                      >
                        <field.icon className={cn("h-3 w-3", field.color)} />
                        <span className="text-muted-foreground">{field.label}:</span>
                        <span className="font-medium text-foreground truncate">
                          {field.value}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Owner Information Section */}
                {(business.ownerFirstName || business.ownerLastName || business.managementTeam?.length) && (
                  <div className="mt-3 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="h-3 w-3 text-amber-400" />
                      <span className="text-xs font-medium text-amber-400">Owner Information</span>
                    </div>

                    {/* Primary Owner */}
                    {(business.ownerFirstName || business.ownerLastName) && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-xs mb-1"
                      >
                        <User className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground">Owner:</span>
                        <span className="font-medium text-foreground">
                          {business.ownerFirstName} {business.ownerLastName}
                          {business.ownerTitle && ` (${business.ownerTitle})`}
                        </span>
                      </motion.div>
                    )}

                    {/* Owner Email */}
                    {business.ownerEmail && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-2 text-xs mb-1"
                      >
                        <Mail className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium text-foreground truncate">
                          {business.ownerEmail}
                        </span>
                        {business.ownerEmailGenerated && (
                          <Badge variant="secondary" className="text-xs ml-1">
                            Generated
                          </Badge>
                        )}
                      </motion.div>
                    )}

                    {/* Management Team */}
                    {business.managementTeam && business.managementTeam.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Management Team:</div>
                        {business.managementTeam.slice(0, 2).map((member, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + idx * 0.1 }}
                            className="flex items-center gap-2 text-xs mb-1"
                          >
                            <User className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-foreground">
                              {member.firstName} {member.lastName}
                            </span>
                            <span className="text-muted-foreground">({member.title})</span>
                          </motion.div>
                        ))}
                        {business.managementTeam.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{business.managementTeam.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {business.url && (
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-white/10 backdrop-blur-sm border border-primary/20 hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(business.url, '_blank')
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-2 text-primary" />
                  Google Maps
                </Button>
              </motion.div>
            )}
            
            {business.website && (
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-white/10 backdrop-blur-sm border border-primary/20 hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(business.website, '_blank')
                  }}
                >
                  <Globe className="h-3 w-3 mr-2 text-primary" />
                  Website
                </Button>
              </motion.div>
            )}
            
            {business.phone && (
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-white/10 backdrop-blur-sm border border-primary/20 hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(`tel:${business.phone}`, '_self')
                  }}
                >
                  <Phone className="h-3 w-3 mr-2 text-primary" />
                  Call
                </Button>
              </motion.div>
            )}
          </div>

          {/* Search Parameters & Quick Stats */}
          {(searchQuery || searchLocation) && (
            <div className="text-xs text-muted-foreground pt-2 border-t border/50 space-y-1">
              {searchQuery && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">Search:</span>
                  <span>{searchQuery}</span>
                </div>
              )}
              {searchLocation && (
                <div className="flex items-center justify-between">
                  <span>Location:</span>
                  <span>{searchLocation}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border/50">
            <span>ID: {business.placeId?.slice(-8) || 'Unknown'}</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" />
              <span>Updated recently</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}