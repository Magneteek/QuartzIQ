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

const formSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  location: z.string().min(1, 'Location is required'),
  ratingFilter: z.object({
    type: z.enum(['min', 'max']),
    value: z.number().min(1).max(5)
  }),
  maxStars: z.number().min(1).max(5),
  dayLimit: z.number().min(1),
  businessLimit: z.number().min(1),
  minReviews: z.number().min(1),
  language: z.string(),
  countryCode: z.string(),
})

type FormData = z.infer<typeof formSchema>

interface SearchFormProps {
  onSearch: (criteria: FormData) => void
  isExtracting: boolean
}

// Professional services categories with proper Google Business Profile mapping
const businessCategories = [
  {
    id: 'tandarts',
    label: 'Dental - Dentist',
    description: 'Dental practices and dentists',
    icon: '🦷'
  },
  {
    id: 'doctor',
    label: 'Medical & Cosmetic',
    description: 'Medical practices, cosmetic surgery, aesthetic clinics',
    icon: '👩‍⚕️'
  },
  {
    id: 'jewelry_store',
    label: 'Luxury Retail & Jewelers',
    description: 'High-end jewelry stores and luxury retail',
    icon: '💎'
  },
  {
    id: 'car_dealer',
    label: 'High-End Car Dealers',
    description: 'Premium automotive dealerships',
    icon: '🚗'
  },
  {
    id: 'financial_consultant',
    label: 'Financial & Business Services',
    description: 'Financial advisors, business consultants, accounting',
    icon: '💼'
  },
  {
    id: 'lawyer',
    label: 'Legal / Professional Services',
    description: 'Law firms, legal consultants, professional services',
    icon: '⚖️'
  },
  {
    id: 'real_estate_agency',
    label: 'Real Estate & Housing',
    description: 'Real estate agencies, property management',
    icon: '🏘️'
  },
  {
    id: 'spa',
    label: 'Wellness & Lifestyle',
    description: 'Spas, wellness centers, beauty salons',
    icon: '🧘‍♀️'
  },
  {
    id: 'insurance_agency',
    label: 'Insurance Agency',
    description: 'Insurance providers and agencies',
    icon: '🛡️'
  },
  {
    id: 'custom',
    label: 'Custom Category',
    description: 'Enter your own business category',
    icon: '⚙️'
  }
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
  { label: 'Norway 🇳🇴', value: 'no', language: 'no', defaultLocation: 'Norge' },
  { label: 'Belgium 🇧🇪', value: 'be', language: 'nl', defaultLocation: 'België' },
  { label: 'Austria 🇦🇹', value: 'at', language: 'de', defaultLocation: 'Österreich' },
  { label: 'France 🇫🇷', value: 'fr', language: 'fr', defaultLocation: 'France' },
  { label: 'Denmark 🇩🇰', value: 'dk', language: 'da', defaultLocation: 'Danmark' },
  { label: 'Sweden 🇸🇪', value: 'se', language: 'sv', defaultLocation: 'Sverige' },
  { label: 'Finland 🇫🇮', value: 'fi', language: 'fi', defaultLocation: 'Suomi' },
]

export function EnhancedSearchForm({ onSearch, isExtracting }: SearchFormProps) {
  const [customCategory, setCustomCategory] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [locationValue, setLocationValue] = useState('')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: 'tandarts',
      location: 'Netherlands',
      ratingFilter: {
        type: 'max',
        value: 4.6
      },
      maxStars: 3,
      dayLimit: 14,
      businessLimit: 5,      // Optimized default - 5 businesses × 5 reviews = 25 total calls
      minReviews: 10,
      language: 'nl',
      countryCode: 'nl',
    },
  })

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
      // Convert ratingFilter back to expected API format
      maxRating: data.ratingFilter.type === 'max' ? data.ratingFilter.value : 5,
      minRating: data.ratingFilter.type === 'min' ? data.ratingFilter.value : 1,
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
  const estimatedCalls = form.watch('businessLimit') * 5
  const estimatedCost = estimatedCalls * 0.001

  return (
    <div className="space-y-4">

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
          {/* Primary Configuration */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Target Configuration</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="bg-white/10 backdrop-blur-sm border border-white/20 hover:scale-105 hover:shadow-lg transition-all duration-200"
              >
                <Filter className="h-4 w-4 mr-2" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </Button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-start">
              {/* Form Fields and Summary - Left Aligned Stack */}
              <div className="flex flex-col gap-3">
                {/* Form Fields Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Country Selection */}
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem className="space-y-1">
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
                  <FormItem className="space-y-1">
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
                      <SelectContent>
                        {businessCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{category.icon}</span>
                              <div className="flex flex-col">
                                <span className="font-medium">{category.label}</span>
                                <span className="text-xs text-muted-foreground">{category.description}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Custom Category Input */}
              <AnimatePresence>
                {form.watch('category') === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="md:col-span-2"
                  >
                    <FormField
                      control={form.control}
                      name="category"
                      render={() => (
                        <FormItem className="space-y-1">
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
                </div>

                {/* Summary Card - Stacked Below Form Fields */}
                <Card className="p-3 bg-white/5 backdrop-blur-sm border border-white/10 w-fit max-w-md">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const selectedCategory = businessCategories.find(cat => cat.id === form.watch('category'))
                        return (
                          <>
                            <span className="text-lg">{selectedCategory?.icon || '🔍'}</span>
                            <div className="text-sm font-medium text-foreground">
                              {selectedCategory?.label || 'Select Category'}
                            </div>
                          </>
                        )
                      })()}
                    </div>

                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>API calls:</span>
                        <span className="font-medium">{estimatedCalls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Est. cost:</span>
                        <span className="font-medium">${estimatedCost.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Businesses:</span>
                        <span className="font-medium">{form.watch('businessLimit')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reviews each:</span>
                        <span className="font-medium">5</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </Card>

          {/* Advanced Parameters */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              >
                <Card className="p-4 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Filter className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Advanced Filters</h3>
                  </div>

                  {/* Location Override */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel className="flex items-center gap-2 text-sm font-medium">
                          <MapPin className="h-4 w-4" />
                          Specific Location (Optional)
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Amsterdam, Berlin, specific city or region..."
                            value={locationValue}
                            onChange={handleLocationChange}
                            className="h-11 bg-white/10 backdrop-blur-sm border border-white/20"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Override the default country location with a specific city or region
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Rating Filter (Min/Max Toggle) */}
                    <FormField
                      control={form.control}
                      name="ratingFilter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-xs font-medium">
                            <Star className="h-3 w-3" />
                            Rating Filter
                          </FormLabel>
                          <div className="space-y-2">
                            {/* Toggle buttons */}
                            <div className="flex rounded-lg bg-white/5 p-1">
                              <button
                                type="button"
                                onClick={() => field.onChange({ ...field.value, type: 'min' })}
                                className={cn(
                                  "flex-1 px-2 py-1 text-xs rounded transition-all",
                                  field.value?.type === 'min'
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                Min
                              </button>
                              <button
                                type="button"
                                onClick={() => field.onChange({ ...field.value, type: 'max' })}
                                className={cn(
                                  "flex-1 px-2 py-1 text-xs rounded transition-all",
                                  field.value?.type === 'max'
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                Max
                              </button>
                            </div>
                            {/* Value input */}
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="5"
                                step="0.1"
                                value={field.value?.value || ''}
                                onChange={(e) => field.onChange({
                                  ...field.value,
                                  value: parseFloat(e.target.value) || 1
                                })}
                                className="h-9 bg-white/10 backdrop-blur-sm border border-white/20 text-sm"
                                placeholder={field.value?.type === 'min' ? 'Min rating' : 'Max rating'}
                              />
                            </FormControl>
                          </div>
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
                          <FormLabel className="flex items-center gap-1 text-xs font-medium">
                            <Star className="h-3 w-3" />
                            Max Stars
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="5"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              className="h-9 bg-white/10 backdrop-blur-sm border border-white/20 text-sm"
                            />
                          </FormControl>
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
                          <FormLabel className="flex items-center gap-1 text-xs font-medium">
                            <Calendar className="h-3 w-3" />
                            Time Range
                          </FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                            <FormControl>
                              <SelectTrigger className="h-9 bg-white/10 backdrop-blur-sm border border-white/20 text-sm">
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Business Limit */}
                    <FormField
                      control={form.control}
                      name="businessLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Max Businesses</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value
                                field.onChange(value === '' ? undefined : parseInt(value) || 1)
                              }}
                              className="h-9 bg-white/10 backdrop-blur-sm border border-white/20 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Min Reviews */}
                    <FormField
                      control={form.control}
                      name="minReviews"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Min Reviews</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value
                                field.onChange(value === '' ? undefined : parseInt(value) || 0)
                              }}
                              className="h-9 bg-white/10 backdrop-blur-sm border border-white/20 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

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