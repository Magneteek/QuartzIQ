'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Loader2,
  Search,
  Globe,
  Building,
  Calendar,
  Star,
  Filter,
  Zap,
  MapPin,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  BarChart3,
  Users,
  Mail,
  Phone,
  Globe2,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCacheDetection } from '@/hooks/use-cache-detection'
import { CacheDetectionBanner } from '@/components/banners/cache-detection-banner'

// Extended form schema with universal search parameters
const formSchema = z.object({
  // Core search
  category: z.string().min(1, 'Category is required'),
  location: z.string().min(1, 'Location is required'),
  language: z.string(),
  countryCode: z.string(),

  // Legacy fields (still supported)
  minRating: z.number().min(1).max(5).optional(),
  maxStars: z.number().min(1).max(5),
  dayLimit: z.number().min(1),
  businessLimit: z.number().min(1),
  maxReviewsPerBusiness: z.number().min(1).max(50),

  // Universal search - Business Filters
  maxRating: z.number().min(1).max(5).optional(),
  minReviewCount: z.number().min(0).optional(),
  maxReviewCount: z.number().min(0).optional(),
  mustHaveWebsite: z.boolean().default(false),
  mustHavePhone: z.boolean().default(false),

  // Universal search - Search Options
  multiLanguageSearch: z.boolean().default(false),

  // Universal search - Review Options
  enableReviews: z.boolean().default(true),
  minStars: z.number().min(1).max(5).optional(),
  mustHavePhotos: z.boolean().default(false),
  requireReviews: z.boolean().default(false), // Only scrape businesses that have Google reviews (reviews_count > 0)

  // Universal search - Enrichment
  enableEnrichment: z.boolean().default(false),
  scrapeWebsite: z.boolean().default(true),
  scrapeSocialMedia: z.boolean().default(true),

  // Universal search - Momentum Tracking
  enableMomentum: z.boolean().default(false),
  momentumPeriod: z.number().min(7).max(90).default(30),
  momentumMinReviews: z.number().min(1).default(5),
  momentumType: z.enum(['growing', 'declining', 'stable', 'spike', 'any']).default('any'),
})

type FormData = z.infer<typeof formSchema>

interface SearchFormProps {
  onSearch: (criteria: any) => void
  isExtracting: boolean
}

// Use case presets
const USE_CASE_PRESETS = {
  leadGeneration: {
    name: 'Lead Generation',
    icon: Target,
    description: 'Get contacts only, no reviews',
    config: {
      enableReviews: false,
      enableEnrichment: true,
      scrapeWebsite: true,
      scrapeSocialMedia: true,
      mustHaveWebsite: true,
      minRating: 4.0,
      minReviewCount: 50,
      enableMomentum: false, // ✅ Can't track momentum without review extraction
    }
  },
  reviewAnalysis: {
    name: 'Review Analysis',
    icon: TrendingUp,
    description: 'Find negative reviews',
    config: {
      enableReviews: true,
      enableEnrichment: true,
      maxStars: 3,
      dayLimit: 14,
      mustHavePhotos: false,
      enableMomentum: false,
      requireReviews: true, // Default ON: skip businesses with 0 Google reviews
    }
  },
  momentumTracking: {
    name: 'Momentum Tracking',
    icon: BarChart3,
    description: 'Declining businesses',
    config: {
      enableReviews: true,
      enableEnrichment: true,
      enableMomentum: true,
      momentumType: 'declining',
      momentumPeriod: 30,
      momentumMinReviews: 5,
      maxStars: 3,
      requireReviews: true, // Default ON: skip businesses with 0 Google reviews
    }
  },
  businessDiscovery: {
    name: 'Business Discovery',
    icon: Search,
    description: 'Quick search, no extras',
    config: {
      enableReviews: false,
      enableEnrichment: false,
      businessLimit: 200,
      minRating: undefined,
    }
  },
}

// Business categories
const businessCategories = [
  // Healthcare & Medical
  { id: 'dentist', label: 'Dentist', sector: 'Healthcare', icon: '🦷' },
  { id: 'doctor', label: 'Doctor', sector: 'Healthcare', icon: '👨‍⚕️' },
  { id: 'hospital', label: 'Hospital', sector: 'Healthcare', icon: '🏥' },
  { id: 'medical_clinic', label: 'Medical Clinic', sector: 'Healthcare', icon: '⚕️' },
  { id: 'pharmacy', label: 'Pharmacy', sector: 'Healthcare', icon: '💊' },
  { id: 'chiropractor', label: 'Chiropractor', sector: 'Healthcare', icon: '🦴' },
  { id: 'physical_therapist', label: 'Physical Therapist', sector: 'Healthcare', icon: '🏃' },
  { id: 'psychologist', label: 'Psychologist', sector: 'Healthcare', icon: '🧠' },
  { id: 'veterinarian', label: 'Veterinarian', sector: 'Healthcare', icon: '🐕' },
  { id: 'optometrist', label: 'Optometrist', sector: 'Healthcare', icon: '👓' },

  // Beauty & Wellness
  { id: 'beauty_salon', label: 'Beauty Salon', sector: 'Beauty & Wellness', icon: '💅' },
  { id: 'hair_salon', label: 'Hair Salon', sector: 'Beauty & Wellness', icon: '💇' },
  { id: 'spa', label: 'Spa', sector: 'Beauty & Wellness', icon: '🧖' },
  { id: 'nail_salon', label: 'Nail Salon', sector: 'Beauty & Wellness', icon: '💅' },
  { id: 'barber_shop', label: 'Barber Shop', sector: 'Beauty & Wellness', icon: '💈' },
  { id: 'massage_therapist', label: 'Massage Therapist', sector: 'Beauty & Wellness', icon: '💆' },
  { id: 'gym', label: 'Gym', sector: 'Beauty & Wellness', icon: '🏋️' },

  // Food & Dining
  { id: 'restaurant', label: 'Restaurant', sector: 'Food & Dining', icon: '🍽️' },
  { id: 'cafe', label: 'Cafe', sector: 'Food & Dining', icon: '☕' },
  { id: 'bar', label: 'Bar', sector: 'Food & Dining', icon: '🍺' },
  { id: 'fast_food_restaurant', label: 'Fast Food Restaurant', sector: 'Food & Dining', icon: '🍔' },
  { id: 'pizza_restaurant', label: 'Pizza Restaurant', sector: 'Food & Dining', icon: '🍕' },
  { id: 'bakery', label: 'Bakery', sector: 'Food & Dining', icon: '🥐' },
  { id: 'coffee_shop', label: 'Coffee Shop', sector: 'Food & Dining', icon: '☕' },
  { id: 'caterer', label: 'Caterer', sector: 'Food & Dining', icon: '🍱' },

  // Hospitality & Travel
  { id: 'hotel', label: 'Hotel', sector: 'Hospitality', icon: '🏨' },
  { id: 'travel_agency', label: 'Travel Agency', sector: 'Hospitality', icon: '✈️' },
  { id: 'tourist_attraction', label: 'Tourist Attraction', sector: 'Hospitality', icon: '🎭' },

  // Retail
  { id: 'jewelry_store', label: 'Jewelry Store', sector: 'Retail', icon: '💎' },
  { id: 'clothing_store', label: 'Clothing Store', sector: 'Retail', icon: '👔' },
  { id: 'furniture_store', label: 'Furniture Store', sector: 'Retail', icon: '🛋️' },
  { id: 'electronics_store', label: 'Electronics Store', sector: 'Retail', icon: '📱' },
  { id: 'grocery_store', label: 'Grocery Store', sector: 'Retail', icon: '🛒' },
  { id: 'gift_shop', label: 'Gift Shop', sector: 'Retail', icon: '🎁' },
  { id: 'pet_store', label: 'Pet Store', sector: 'Retail', icon: '🐾' },
  { id: 'florist', label: 'Florist', sector: 'Retail', icon: '🌺' },

  // Automotive
  { id: 'car_dealer', label: 'Car Dealer', sector: 'Automotive', icon: '🚗' },
  { id: 'auto_repair_shop', label: 'Auto Repair Shop', sector: 'Automotive', icon: '🔧' },
  { id: 'car_wash', label: 'Car Wash', sector: 'Automotive', icon: '🧼' },
  { id: 'tire_shop', label: 'Tire Shop', sector: 'Automotive', icon: '🛞' },
  { id: 'auto_body_shop', label: 'Auto Body Shop', sector: 'Automotive', icon: '🔨' },
  { id: 'auto_parts_store', label: 'Auto Parts Store', sector: 'Automotive', icon: '⚙️' },

  // Professional Services
  { id: 'lawyer', label: 'Lawyer', sector: 'Professional Services', icon: '⚖️' },
  { id: 'attorney', label: 'Attorney', sector: 'Professional Services', icon: '👨‍⚖️' },
  { id: 'accountant', label: 'Accountant', sector: 'Professional Services', icon: '💼' },
  { id: 'financial_planner', label: 'Financial Planner', sector: 'Professional Services', icon: '📊' },
  { id: 'insurance_agency', label: 'Insurance Agency', sector: 'Professional Services', icon: '🛡️' },
  { id: 'real_estate_agency', label: 'Real Estate Agency', sector: 'Professional Services', icon: '🏠' },
  { id: 'real_estate_agent', label: 'Real Estate Agent', sector: 'Professional Services', icon: '🏘️' },
  { id: 'mortgage_lender', label: 'Mortgage Lender', sector: 'Professional Services', icon: '🏦' },
  { id: 'consultant', label: 'Consultant', sector: 'Professional Services', icon: '💡' },
  { id: 'marketing_agency', label: 'Marketing Agency', sector: 'Professional Services', icon: '📈' },

  // Home Services
  { id: 'plumber', label: 'Plumber', sector: 'Home Services', icon: '🚰' },
  { id: 'electrician', label: 'Electrician', sector: 'Home Services', icon: '⚡' },
  { id: 'hvac_contractor', label: 'HVAC Contractor', sector: 'Home Services', icon: '❄️' },
  { id: 'general_contractor', label: 'General Contractor', sector: 'Home Services', icon: '🏗️' },
  { id: 'roofing_contractor', label: 'Roofing Contractor', sector: 'Home Services', icon: '🏠' },
  { id: 'landscaper', label: 'Landscaper', sector: 'Home Services', icon: '🌳' },
  { id: 'painter', label: 'Painter', sector: 'Home Services', icon: '🎨' },
  { id: 'house_cleaning_service', label: 'House Cleaning Service', sector: 'Home Services', icon: '🧹' },
  { id: 'pest_control_service', label: 'Pest Control Service', sector: 'Home Services', icon: '🐜' },
  { id: 'locksmith', label: 'Locksmith', sector: 'Home Services', icon: '🔐' },

  // Education
  { id: 'school', label: 'School', sector: 'Education', icon: '🏫' },
  { id: 'preschool', label: 'Preschool', sector: 'Education', icon: '👶' },
  { id: 'tutoring_service', label: 'Tutoring Service', sector: 'Education', icon: '📚' },
  { id: 'driving_school', label: 'Driving School', sector: 'Education', icon: '🚗' },

  // Entertainment & Recreation
  { id: 'movie_theater', label: 'Movie Theater', sector: 'Entertainment', icon: '🎬' },
  { id: 'bowling_alley', label: 'Bowling Alley', sector: 'Entertainment', icon: '🎳' },
  { id: 'amusement_park', label: 'Amusement Park', sector: 'Entertainment', icon: '🎢' },
  { id: 'museum', label: 'Museum', sector: 'Entertainment', icon: '🏛️' },
  { id: 'art_gallery', label: 'Art Gallery', sector: 'Entertainment', icon: '🖼️' },

  // Pet Services
  { id: 'pet_groomer', label: 'Pet Groomer', sector: 'Pet Services', icon: '🐕' },
  { id: 'dog_trainer', label: 'Dog Trainer', sector: 'Pet Services', icon: '🦮' },
  { id: 'pet_boarding_service', label: 'Pet Boarding Service', sector: 'Pet Services', icon: '🏠' },

  // Technology
  { id: 'computer_repair_service', label: 'Computer Repair Service', sector: 'Technology', icon: '💻' },
  { id: 'cell_phone_store', label: 'Cell Phone Store', sector: 'Technology', icon: '📱' },
  { id: 'software_company', label: 'Software Company', sector: 'Technology', icon: '💾' },

  // Custom (fallback for unlisted categories)
  { id: 'custom', label: 'Custom Category', sector: 'Other', icon: '⚙️' },
]

const timeRanges = [
  { label: 'Last 7 days', value: 7, color: 'text-green-400' },
  { label: 'Last 14 days', value: 14, color: 'text-blue-400' },
  { label: 'Last 30 days', value: 30, color: 'text-primary' },
  { label: 'Last 60 days', value: 60, color: 'text-orange-400' },
  { label: 'Last 90 days', value: 90, color: 'text-red-400' },
]

const countries = [
  { label: 'Netherlands 🇳🇱', value: 'nl', language: 'nl', defaultLocation: 'Netherlands' },
  { label: 'Germany 🇩🇪', value: 'de', language: 'de', defaultLocation: 'Deutschland' },
  { label: 'Switzerland 🇨🇭', value: 'ch', language: 'de', defaultLocation: 'Schweiz' },
  { label: 'Belgium 🇧🇪', value: 'be', language: 'nl', defaultLocation: 'België' },
  { label: 'Austria 🇦🇹', value: 'at', language: 'de', defaultLocation: 'Österreich' },
  { label: 'Spain 🇪🇸', value: 'es', language: 'es', defaultLocation: 'España' },
  { label: 'Slovenia 🇸🇮', value: 'si', language: 'sl', defaultLocation: 'Slovenija' },
  { label: 'Croatia 🇭🇷', value: 'hr', language: 'hr', defaultLocation: 'Hrvatska' },
]

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number; zoom: number; bbox?: [number, number, number, number] } | null> {
  try {
    const params = new URLSearchParams({ q: location, format: 'json', limit: '1' })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'QuartzIQ/1.0' }
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.length) return null
    const { lat, lon, type, class: cls, boundingbox } = data[0]
    // Zoom: country=5, state/region=8, city=12, district=14
    let zoom = 12
    if (cls === 'boundary' && type === 'administrative') zoom = 8
    if (type === 'country') zoom = 5
    if (type === 'city' || type === 'town') zoom = 12
    if (type === 'suburb' || type === 'borough') zoom = 14
    // boundingbox from Nominatim: [south, north, west, east]
    const bbox: [number, number, number, number] | undefined = boundingbox
      ? [parseFloat(boundingbox[0]), parseFloat(boundingbox[1]), parseFloat(boundingbox[2]), parseFloat(boundingbox[3])]
      : undefined
    return { lat: parseFloat(lat), lng: parseFloat(lon), zoom, bbox }
  } catch {
    return null
  }
}

export function EnhancedSearchForm({ onSearch, isExtracting }: SearchFormProps) {
  const [customCategory, setCustomCategory] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [locationValue, setLocationValue] = useState('Netherlands')
  const [useCached, setUseCached] = useState(false)
  const [geocodeResult, setGeocodeResult] = useState<{ lat: number; lng: number; zoom: number; bbox?: [number, number, number, number] } | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>('businessDiscovery')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Apply default preset on mount
  useEffect(() => {
    if (activePreset === 'businessDiscovery') {
      const preset = USE_CASE_PRESETS.businessDiscovery
      Object.entries(preset.config).forEach(([key, value]) => {
        form.setValue(key as any, value)
      })
    }
  }, []) // Only run once on mount

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: 'dentist',
      location: 'Netherlands',
      minRating: undefined,
      maxStars: 3,
      dayLimit: 14,
      businessLimit: 200, // ✅ Business Discovery default
      maxReviewsPerBusiness: 2,
      language: 'nl',
      countryCode: 'nl',
      // Universal search defaults (Business Discovery preset)
      enableReviews: false, // ✅ No reviews by default
      enableEnrichment: false, // ✅ No enrichment by default
      scrapeWebsite: true,
      scrapeSocialMedia: true,
      mustHaveWebsite: false,
      mustHavePhone: false,
      mustHavePhotos: false,
      requireReviews: false,
      multiLanguageSearch: false,
      enableMomentum: false,
      momentumPeriod: 30,
      momentumMinReviews: 5,
      momentumType: 'any',
    },
  })

  // Cache detection
  const watchedCategory = form.watch('category')
  const watchedLocation = locationValue

  const { cacheData, isChecking } = useCacheDetection(
    watchedCategory !== 'custom' ? watchedCategory : customCategory,
    watchedLocation
  )

  // Apply preset
  const applyPreset = (presetKey: keyof typeof USE_CASE_PRESETS) => {
    const preset = USE_CASE_PRESETS[presetKey]
    Object.entries(preset.config).forEach(([key, value]) => {
      form.setValue(key as any, value)
    })
    setActivePreset(presetKey)
    // Auto-expand advanced options when preset is applied
    if (!showAdvanced) setShowAdvanced(true)
  }

  const onSubmit = (data: FormData) => {
    // Convert to universal search format
    const universalCriteria = {
      category: data.category === 'custom' ? customCategory : data.category,
      location: locationValue,
      countryCode: data.countryCode,
      language: data.language,

      businessFilters: {
        minRating: data.minRating,
        maxRating: data.maxRating,
        // requireReviews overrides minReviewCount: if ON, ensure at least 1 review required
        minReviewCount: data.requireReviews ? Math.max((data.minReviewCount || 0), 1) : data.minReviewCount,
        maxReviewCount: data.maxReviewCount,
        mustHaveWebsite: data.mustHaveWebsite,
        mustHavePhone: data.mustHavePhone,
        multiLanguageSearch: data.multiLanguageSearch,
        ...(data.enableMomentum && {
          reviewMomentum: {
            enabled: true,
            period: data.momentumPeriod,
            minReviewsInPeriod: data.momentumMinReviews,
            type: data.momentumType,
          }
        }),
      },

      reviewFilters: {
        enabled: data.enableReviews,
        minStars: data.minStars,
        maxStars: data.maxStars,
        dayLimit: data.dayLimit,
        mustHavePhotos: data.mustHavePhotos,
      },

      limits: {
        maxBusinesses: data.businessLimit,
        maxReviewsPerBusiness: data.maxReviewsPerBusiness,
      },

      enrichment: {
        enabled: data.enableEnrichment,
        apifyEnrichment: {
          enabled: data.enableEnrichment,
          scrapeWebsite: data.scrapeWebsite,
          scrapeSocialMedia: data.scrapeSocialMedia,
          maxPagesPerSite: 1,
        },
      },

      output: {
        includeReviews: data.enableReviews,
        format: 'full',
      },

      // Legacy compatibility
      useCached: useCached && cacheData?.hasCached,

      // Geocoding coordinates (if resolved)
      ...(geocodeResult && {
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        zoom: geocodeResult.zoom,
        ...(geocodeResult.bbox && { bbox: geocodeResult.bbox }),
      }),
    }

    onSearch(universalCriteria)
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationValue(e.target.value)
    form.setValue('location', e.target.value)
    setGeocodeResult(null) // reset coords when location changes
  }

  const handleLocationBlur = async () => {
    const loc = locationValue.trim()
    if (!loc || loc.length < 2) return
    setIsGeocoding(true)
    const result = await geocodeLocation(loc)
    setGeocodeResult(result)
    setIsGeocoding(false)
  }

  if (!isMounted) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-gray-100 rounded animate-pulse"></div>
        <div className="h-40 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  const selectedCategory = businessCategories.find(cat => cat.id === form.watch('category'))

  return (
    <div className="w-full space-y-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

          {/* 🆕 USE CASE PRESETS - Compact */}
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-semibold">Quick Presets</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(USE_CASE_PRESETS).map(([key, preset]) => {
                const Icon = preset.icon
                const isActive = activePreset === key
                return (
                  <Button
                    key={key}
                    type="button"
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applyPreset(key as keyof typeof USE_CASE_PRESETS)}
                    className={cn(
                      "flex flex-col items-center gap-1 h-auto py-2 text-xs",
                      isActive && "ring-2 ring-primary"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="font-medium leading-tight">{preset.name}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{preset.description}</span>
                  </Button>
                )
              })}
            </div>
          </Card>

          {/* Core Search Configuration - Compact Inline Layout */}
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-sm font-semibold">Search Configuration</h3>
            </div>

            {/* All fields in 1 row */}
            <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-xs font-medium">Country</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value)
                      const country = countries.find(c => c.value === value)
                      if (country) {
                        form.setValue('language', country.language)
                        form.setValue('location', country.defaultLocation)
                        setLocationValue(country.defaultLocation)
                      }
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.value} value={country.value} className="text-xs">
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-xs font-medium">Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[400px]">
                        {businessCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id} className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{category.icon}</span>
                              <span>{category.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-xs font-medium flex items-center gap-1">
                      Location
                      {isGeocoding && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      {geocodeResult && !isGeocoding && (
                        <span className="text-green-500 text-[10px] font-normal">
                          📍 {geocodeResult.lat.toFixed(3)}, {geocodeResult.lng.toFixed(3)}
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Fuerteventura, Spain"
                        value={locationValue}
                        onChange={handleLocationChange}
                        onBlur={handleLocationBlur}
                        className="h-8 text-xs"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessLimit"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel className="text-xs font-medium">Max Biz</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 50)}
                        className="h-8 text-xs"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minRating"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel className="text-xs font-medium" title="Min business rating on Google (e.g. 3.5 = only show businesses rated 3.5+). Leave blank for any rating.">Min Biz★</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        step="0.1"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        className="h-8 text-xs"
                        placeholder="Any"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxStars"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel className="text-xs font-medium" title="Max stars for a review to qualify as negative (default 3 = collect 1★ 2★ 3★ reviews)">Max Rev★</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="h-8 text-xs"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dayLimit"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel className="text-xs font-medium">Days</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeRanges.map((range) => (
                          <SelectItem key={range.value} value={range.value.toString()} className="text-xs">
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxReviewsPerBusiness"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel className="text-xs font-medium">Rev/Biz</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 2)}
                        className="h-8 text-xs"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </Card>

          {/* 🆕 ADVANCED OPTIONS */}
          <Card className="p-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-2 hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Advanced Options</span>
                {(form.watch('enableEnrichment') || form.watch('enableMomentum') || !form.watch('enableReviews')) && (
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">Active</span>
                )}
              </div>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 space-y-3 overflow-hidden"
                >
                  {/* Main Toggles - 3 Column Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="enableReviews"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2">
                          <div className="flex-1 mr-2">
                            <FormLabel className="text-xs">Extract Reviews</FormLabel>
                            <FormDescription className="text-[10px]">
                              Disable for lead gen only (saves $0.02/biz)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enableEnrichment"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2">
                          <div className="flex-1 mr-2">
                            <FormLabel className="text-xs">Contact Enrichment</FormLabel>
                            <FormDescription className="text-[10px]">
                              Get emails, phones, social (+$0.005/biz)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="multiLanguageSearch"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2">
                          <div className="flex-1 mr-2">
                            <FormLabel className="text-xs">Multi-Language</FormLabel>
                            <FormDescription className="text-[10px]">
                              Search in both local + English (2× cost, better discovery)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enableMomentum"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2">
                          <div className="flex-1 mr-2">
                            <FormLabel className="text-xs">Review Momentum</FormLabel>
                            <FormDescription className="text-[10px]">
                              Find trending/declining businesses
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mustHaveWebsite"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2">
                          <div className="flex-1 mr-2">
                            <FormLabel className="text-xs">Must Have Website</FormLabel>
                            <FormDescription className="text-[10px]">
                              Filter for businesses with websites
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mustHavePhone"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-2">
                          <div className="flex-1 mr-2">
                            <FormLabel className="text-xs">Must Have Phone</FormLabel>
                            <FormDescription className="text-[10px]">
                              Filter for businesses with phone numbers
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Review Options - Only show additional options if reviews enabled */}
                  {form.watch('enableReviews') && (
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <Star className="h-3 w-3" />
                        Review Options
                      </h4>
                      <div className="grid gap-2">
                        <FormField
                          control={form.control}
                          name="requireReviews"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 p-2">
                              <div>
                                <FormLabel className="text-xs">Has Reviews (Recommended)</FormLabel>
                                <FormDescription className="text-[10px]">
                                  Skip businesses with 0 Google reviews — no reviews = nothing to extract
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="mustHavePhotos"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-2">
                              <div>
                                <FormLabel className="text-xs">Require Photos</FormLabel>
                                <FormDescription className="text-[10px]">
                                  Only return reviews with images. Default: OFF (photos are optional)
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {/* Review Qualification Rules Explanation */}
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 space-y-2">
                          <h4 className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                            <Star className="h-3 w-3" />
                            Review Qualification Rules
                          </h4>
                          <div className="space-y-1.5 text-[10px] text-muted-foreground">
                            {form.watch('mustHavePhotos') ? (
                              // Image search mode - NO time limit
                              <>
                                <div className="flex items-start gap-1.5">
                                  <span className="text-blue-400 font-bold mt-0.5">✓</span>
                                  <div>
                                    <span className="font-medium text-blue-300">Active Rule:</span> 1-3⭐ reviews
                                    with image (any age, <span className="text-yellow-400 font-semibold">no time limit</span>)
                                  </div>
                                </div>
                                <div className="pt-1 border-t border-blue-500/20 text-blue-300/80 italic">
                                  Searching ALL reviews for images regardless of age. Day limit is ignored.
                                </div>
                              </>
                            ) : (
                              // Text search mode - WITH time limit
                              <>
                                <div className="flex items-start gap-1.5">
                                  <span className="text-blue-400 font-bold mt-0.5">✓</span>
                                  <div>
                                    <span className="font-medium text-blue-300">Active Rule:</span> 1-3⭐ reviews,
                                    ≤{form.watch('dayLimit')} days old, must have text OR image
                                  </div>
                                </div>
                                <div className="pt-1 border-t border-blue-500/20 text-blue-300/80 italic">
                                  Searching reviews within {form.watch('dayLimit')}-day timeframe.
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enrichment Sub-Options */}
                  {form.watch('enableEnrichment') && (
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <Mail className="h-3 w-3" />
                        Enrichment Sources
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name="scrapeWebsite"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-1.5">
                              <FormLabel className="text-[10px]">Websites</FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="scrapeSocialMedia"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-1.5">
                              <FormLabel className="text-[10px]">Social Media</FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Business Filters - Min/Max Review Count */}
                  <div className="space-y-2 pt-2 border-t">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                      <Filter className="h-3 w-3" />
                      Review Count Filters
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="minReviewCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px]">Min Reviews</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                value={field.value || ''}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                                className="h-7 text-xs"
                                placeholder="Any"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maxReviewCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px]">Max Reviews</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                value={field.value || ''}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                                className="h-7 text-xs"
                                placeholder="Any"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Momentum Settings */}
                  {form.watch('enableMomentum') && (
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3" />
                        Momentum Settings
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name="momentumPeriod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px]">Period (days)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="7"
                                  max="90"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                                  className="h-7 text-xs"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="momentumMinReviews"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px]">Min Reviews</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                                  className="h-7 text-xs"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="momentumType"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel className="text-[10px]">Trend Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="any" className="text-xs">Any Trend</SelectItem>
                                  <SelectItem value="growing" className="text-xs">Growing (50%+ increase)</SelectItem>
                                  <SelectItem value="declining" className="text-xs">Declining (50%+ decrease)</SelectItem>
                                  <SelectItem value="spike" className="text-xs">Spike (200%+ increase)</SelectItem>
                                  <SelectItem value="stable" className="text-xs">Stable (±50%)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Cache Detection Banner */}
          {watchedCategory && watchedLocation && (
            <CacheDetectionBanner
              cachedCount={cacheData?.cachedCount || 0}
              category={watchedCategory === 'custom' ? customCategory : (selectedCategory?.label || watchedCategory)}
              location={watchedLocation}
              costComparison={cacheData?.costComparison || {
                searchNew: 0.5,
                useCached: 0,
                savings: 0.5,
                savingsPercent: 0
              }}
              onUseCached={() => setUseCached(true)}
              onSearchNew={() => setUseCached(false)}
              isLoading={isChecking}
            />
          )}

          {/* Submit Button - Normal Size */}
          <div className="flex justify-center pt-1">
            <Button
              type="submit"
              disabled={isExtracting}
              className="w-full md:w-auto px-8"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Start Extraction
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
