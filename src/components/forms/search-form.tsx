'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Search } from 'lucide-react'

const formSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  location: z.string().min(1, 'Location is required'),
  maxRating: z.number().min(1).max(5),
  maxStars: z.number().min(1).max(5),
  dayLimit: z.number().min(1),
  businessLimit: z.number().min(1),
  minReviews: z.number().min(1),
  minTextLength: z.number().min(0),
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
    description: 'Dental practices and dentists'
  },
  {
    id: 'doctor',
    label: 'Medical & Cosmetic',
    description: 'Medical practices, cosmetic surgery, aesthetic clinics'
  },
  {
    id: 'jewelry_store',
    label: 'Luxury Retail & Jewelers',
    description: 'High-end jewelry stores and luxury retail'
  },
  {
    id: 'car_dealer',
    label: 'High-End Car Dealers',
    description: 'Premium automotive dealerships'
  },
  {
    id: 'financial_consultant',
    label: 'Financial & Business Services',
    description: 'Financial advisors, business consultants, accounting'
  },
  {
    id: 'lawyer',
    label: 'Legal / Professional Services',
    description: 'Law firms, legal consultants, professional services'
  },
  {
    id: 'real_estate_agency',
    label: 'Real Estate & Housing',
    description: 'Real estate agencies, property management'
  },
  {
    id: 'spa',
    label: 'Wellness & Lifestyle',
    description: 'Spas, wellness centers, beauty salons'
  },
  {
    id: 'insurance_agency',
    label: 'Insurance Agency',
    description: 'Insurance providers and agencies'
  },
  {
    id: 'custom',
    label: 'Custom Category',
    description: 'Enter your own business category'
  }
]

const timeRanges = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 14 days', value: 14 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 60 days', value: 60 },
  { label: 'Last 90 days', value: 90 },
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


export function SearchForm({ onSearch, isExtracting }: SearchFormProps) {
  const [customCategory, setCustomCategory] = useState('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: 'tandarts',
      location: 'Netherlands',
      maxRating: 4.6,
      maxStars: 3,
      dayLimit: 14,
      businessLimit: 5,      // Optimized default - 5 businesses × 5 reviews = 25 total calls
      minReviews: 10,
      minTextLength: 20,
      language: 'nl',
      countryCode: 'nl',
    },
  })

  const onSubmit = (data: FormData) => {
    const finalData = {
      ...data,
      category: data.category === 'custom' ? customCategory : data.category,
    }
    onSearch(finalData)
  }

  // Prevent hydration mismatch by only rendering on client
  if (!isMounted) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
          <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
        </div>
        <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
        {/* Primary Selection Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Country Selection */}
          <FormField
            control={form.control}
            name="countryCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Country</FormLabel>
                <Select onValueChange={(value) => {
                  field.onChange(value)
                  const country = countries.find(c => c.value === value)
                  if (country) {
                    form.setValue('language', country.language)
                    form.setValue('location', country.defaultLocation)
                  }
                }} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9">
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
                <FormLabel className="text-sm">Business Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {businessCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{category.label}</span>
                          <span className="text-xs text-muted-foreground">{category.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Custom Category Input */}
        {form.watch('category') === 'custom' && (
          <FormField
            control={form.control}
            name="category"
            render={() => (
              <FormItem>
                <FormLabel className="text-sm">Custom Category</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter custom business category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="h-9"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        {/* Compact Parameters Row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          {/* Max Business Rating - Compact */}
          <FormField
            control={form.control}
            name="maxRating"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Max Rating</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    className="h-8 w-full text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Max Review Stars - Compact */}
          <FormField
            control={form.control}
            name="maxStars"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Max Stars</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                    className="h-8 w-full text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Time Range - Compact */}
          <FormField
            control={form.control}
            name="dayLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Time Range</FormLabel>
                <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                  <FormControl>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {timeRanges.map((range) => (
                      <SelectItem key={range.value} value={range.value.toString()}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Business Limit - Compact */}
          <FormField
            control={form.control}
            name="businessLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Max Businesses</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === '' ? undefined : parseInt(value) || 1)
                    }}
                    className="h-8 w-full text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Min Reviews - Compact */}
          <FormField
            control={form.control}
            name="minReviews"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Min Reviews</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === '' ? undefined : parseInt(value) || 0)
                    }}
                    className="h-8 w-full text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Min Text Length - Compact */}
          <FormField
            control={form.control}
            name="minTextLength"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Min Text</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === '' ? undefined : parseInt(value) || 0)
                    }}
                    className="h-8 w-full text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Cost Info - Single Line */}
        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded flex items-center justify-between">
          <span>📊 Estimated: {form.watch('businessLimit')} businesses × 5 reviews = {form.watch('businessLimit') * 5} API calls</span>
          <span className="font-medium">~${((form.watch('businessLimit') * 5) * 0.001).toFixed(3)} cost</span>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center pt-2">
          <Button type="submit" disabled={isExtracting} size="lg" className="min-w-[200px]">
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Start Extraction
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}