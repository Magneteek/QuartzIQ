'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Star, 
  MapPin, 
  ExternalLink, 
  Phone, 
  Globe, 
  Mail, 
  Building,
  TrendingDown,
  TrendingUp,
  Calendar,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  }
  index?: number
  isSelected?: boolean
  onToggleSelect?: () => void
}

export function EnhancedBusinessCard({ 
  business, 
  index = 0, 
  isSelected = false, 
  onToggleSelect 
}: BusinessCardProps) {
  
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

  const getRatingTrend = (rating: number) => {
    if (rating >= 4.0) return { icon: TrendingUp, color: 'text-green-400', label: 'High' }
    if (rating >= 3.5) return { icon: TrendingDown, color: 'text-orange-400', label: 'Medium' }
    return { icon: TrendingDown, color: 'text-red-400', label: 'Poor' }
  }

  const trend = getRatingTrend(business.totalScore)
  const TrendIcon = trend.icon

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
          "cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg overflow-hidden",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
        onClick={onToggleSelect}
      >
        {/* Selection Indicator */}
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
            <div className="space-y-2 flex-1 pr-2">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-lg leading-tight line-clamp-2 text-foreground">
                  {business.title}
                </h3>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="line-clamp-1">{business.address}</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <Badge className={cn("text-xs font-medium", getRatingColor(business.totalScore))}>
                {business.totalScore.toFixed(1)}
              </Badge>
              <div className={cn("flex items-center gap-1", trend.color)}>
                <TrendIcon className="h-3 w-3" />
                <span className="text-xs font-medium">{trend.label}</span>
              </div>
            </div>
          </div>

          {/* Rating & Reviews Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {getStarRating(business.totalScore)}
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {business.reviewsCount.toLocaleString()}
                </span>
                <span className="text-muted-foreground">reviews</span>
              </div>
            </div>

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
                  className="w-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(business.url, '_blank')
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
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
                  className="w-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-secondary/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(business.website, '_blank')
                  }}
                >
                  <Globe className="h-3 w-3 mr-2" />
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
                  className="w-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-green-500/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(`tel:${business.phone}`, '_self')
                  }}
                >
                  <Phone className="h-3 w-3 mr-2" />
                  Call
                </Button>
              </motion.div>
            )}
          </div>

          {/* Quick Stats Bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border/50">
            <span>ID: {business.placeId?.slice(-8) || 'Unknown'}</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Updated recently</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}