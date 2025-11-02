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
import { Loader2, Search, Globe, Building, Calendar, Star, Filter, Zap, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCacheDetection } from '@/hooks/use-cache-detection'
import { CacheDetectionBanner } from '@/components/banners/cache-detection-banner'

const formSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  location: z.string().min(1, 'Location is required'),
  minRating: z.number().min(1).max(5).optional(),
  maxStars: z.number().min(1).max(5),
  dayLimit: z.number().min(1),
  businessLimit: z.number().min(1), // No upper limit - user can set as high as needed
  maxReviewsPerBusiness: z.number().min(1).max(50), // Reviews per business limit
  language: z.string(),
  countryCode: z.string(),
})

type FormData = z.infer<typeof formSchema>

interface SearchFormProps {
  onSearch: (criteria: FormData) => void
  isExtracting: boolean
}

// Google Business Profile Official Categories - Organized by Sector
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

export function EnhancedSearchForm({ onSearch, isExtracting }: SearchFormProps) {
  const [customCategory, setCustomCategory] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [locationValue, setLocationValue] = useState('')
  const [useCached, setUseCached] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: 'dentist',   // Using official Google Business category
      location: 'Netherlands',
      minRating: 3.5,        // Default: filter out businesses with poor overall ratings
      maxStars: 3,           // Default: capture only negative reviews (3 stars or lower)
      dayLimit: 14,          // Default: last 14 days
      businessLimit: 50,     // Safeguard: stop after 50 businesses crawled
      maxReviewsPerBusiness: 2, // Default: 2 reviews per business (cost optimization)
      language: 'nl',
      countryCode: 'nl',
    },
  })

  // Cache detection hook
  const watchedCategory = form.watch('category')
  const watchedLocation = locationValue || form.watch('location')

  const { cacheData, isChecking } = useCacheDetection(
    watchedCategory !== 'custom' ? watchedCategory : customCategory,
    watchedLocation
  )

  const placeholders = [
    "Search for dental practices in Amsterdam...",
    "Find restaurants in Berlin with poor reviews...",
    "Discover luxury hotels in Zurich needing attention...",
    "Extract reviews from spas in Oslo...",
    "Find financial consultants in Brussels..."
  ]

  const onSubmit = (data: FormData) => {
    const finalData = {
      ...data,
      category: data.category === 'custom' ? customCategory : data.category,
      location: locationValue || data.location,
      // Clean undefined values for API
      minRating: data.minRating || undefined,
      // Add cache usage flag
      useCached: useCached && cacheData?.hasCached
    };
    onSearch(finalData);
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationValue(e.target.value)
    form.setValue('location', e.target.value)
  }


  // Prevent hydration mismatch by only rendering on client
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
    <div className="space-y-4">

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
          {/* Unified Configuration - All Filters Visible */}
          <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Search Configuration</h3>
            </div>

            {/* Primary Filters - Country, Category, Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Country Selection */}
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-medium">
                      <Globe className="h-4 w-4" />
                      Target Country
                    </FormLabel>
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
                        <SelectTrigger className="h-11 bg-white/10 backdrop-blur-sm border border-white/20">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Business Category */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-medium">
                      <Building className="h-4 w-4" />
                      Business Category
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 bg-white/10 backdrop-blur-sm border border-white/20">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[400px]">
                        {/* Group categories by sector */}
                        {Object.entries(
                          businessCategories.reduce((acc, category) => {
                            if (!acc[category.sector]) acc[category.sector] = []
                            acc[category.sector].push(category)
                            return acc
                          }, {} as Record<string, typeof businessCategories>)
                        ).map(([sector, categories]) => (
                          <div key={sector} className="mb-2">
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-white/5">
                              {sector}
                            </div>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  <span>{category.icon}</span>
                                  <span>{category.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location Override */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4" />
                      Specific Location
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Amsterdam, Berlin..."
                        value={locationValue}
                        onChange={handleLocationChange}
                        className="h-11 bg-white/10 backdrop-blur-sm border border-white/20"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Optional: Target specific city or region
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* Custom Category Input */}
            <AnimatePresence>
              {form.watch('category') === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <FormField
                    control={form.control}
                    name="category"
                    render={() => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Custom Category</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., yoga studios, tech companies, bakeries..."
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            className="h-11 bg-white/10 backdrop-blur-sm border border-white/20"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filter Parameters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Min Business Score */}
                    <FormField
                      control={form.control}
                      name="minRating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-sm font-medium">
                            <Star className="h-4 w-4" />
                            Min Business Score
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="5"
                              step="0.1"
                              value={field.value || ''}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                              className="h-11 bg-white/10 backdrop-blur-sm border border-white/20"
                              placeholder="e.g. 3.5"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Filter out businesses with poor overall ratings
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Max Review Stars */}
                    <FormField
                      control={form.control}
                      name="maxStars"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-sm font-medium">
                            <Star className="h-4 w-4" />
                            Max Review Stars
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="5"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              className="h-11 bg-white/10 backdrop-blur-sm border border-white/20"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Capture only negative reviews (3 or lower)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Time Range */}
                    <FormField
                      control={form.control}
                      name="dayLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-sm font-medium">
                            <Calendar className="h-4 w-4" />
                            Review Age
                          </FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                            <FormControl>
                              <SelectTrigger className="h-11 bg-white/10 backdrop-blur-sm border border-white/20">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timeRanges.map((range) => (
                                <SelectItem key={range.value} value={range.value.toString()}>
                                  <span className={range.color}>{range.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            How recent the reviews should be
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Max Businesses to Crawl */}
                    <FormField
                      control={form.control}
                      name="businessLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-sm font-medium">
                            <Building className="h-4 w-4" />
                            Max Businesses
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value
                                field.onChange(value === '' ? undefined : parseInt(value) || 1)
                              }}
                              className="h-11 bg-white/10 backdrop-blur-sm border border-white/20"
                              placeholder="No limit - set as high as needed"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            No maximum limit - you control the budget (default: 50)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Reviews Per Business */}
                    <FormField
                      control={form.control}
                      name="maxReviewsPerBusiness"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-sm font-medium">
                            <Star className="h-4 w-4" />
                            Reviews Per Business
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value
                                field.onChange(value === '' ? undefined : parseInt(value) || 1)
                              }}
                              className="h-11 bg-white/10 backdrop-blur-sm border border-white/20"
                              placeholder="2 reviews (default)"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Reviews to extract per business (default: 2, max: 50)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

            </div>

            {/* Search Summary */}
            <Card className="p-3 bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-1 text-xs text-foreground flex-wrap">
                {(() => {
                  const selectedCategory = businessCategories.find(cat => cat.id === form.watch('category'))
                  const country = countries.find(c => c.value === form.watch('countryCode'))
                  const location = locationValue || form.watch('location')
                  const targetLocation = location !== country?.defaultLocation ? location : country?.flag || '🌍'

                  const parts = [
                    `${selectedCategory?.icon || '🔍'} ${selectedCategory?.label || 'Select Category'}`,
                    `Target: ${targetLocation}`,
                    `Business score: ${form.watch('minRating') ? `≥${form.watch('minRating')}⭐` : 'Any'}`,
                    `Review stars: ≤${form.watch('maxStars')}⭐`,
                    `Timeframe: ${form.watch('dayLimit')} days`,
                    `Max businesses: ${form.watch('businessLimit')}`
                  ]

                  return parts.map((part, index) => (
                    <span key={index} className="inline-flex items-center">
                      {part}
                      {index < parts.length - 1 && (
                        <span className="mx-2 text-muted-foreground">|</span>
                      )}
                    </span>
                  ))
                })()}
              </div>
            </Card>
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

          {/* Prominent Submit Button */}
          <div className="flex justify-center pt-2">
            <motion.div
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.02 }}
            >
              <Button
                type="submit"
                disabled={isExtracting}
                size="lg"
                className="min-w-[300px] h-14 bg-primary text-primary-foreground border-0 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                    Extracting Data...
                  </>
                ) : (
                  <>
                    <Zap className="mr-3 h-6 w-6" />
                    Start AI Extraction
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </form>
      </Form>
    </div>
  )
}