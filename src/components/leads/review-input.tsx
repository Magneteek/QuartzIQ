'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, Trash2, Plus, MessageSquare } from 'lucide-react'

const reviewSchema = z.object({
  reviewer_name: z.string().min(2, 'Reviewer name must be at least 2 characters'),
  rating: z.number().min(1).max(5, 'Rating must be between 1 and 5'),
  review_text: z.string().min(10, 'Review text must be at least 10 characters'),
  review_date: z.string().optional(),
  response_text: z.string().optional(),
  source: z.enum(['google', 'facebook', 'yelp', 'other']).optional(),
})

type ReviewFormData = z.infer<typeof reviewSchema>

interface Review {
  id: string
  reviewer_name: string
  rating: number
  review_text: string
  review_date: string | null
  response_text: string | null
  source: string
}

interface ReviewInputProps {
  businessId: string
  businessName: string
  onReviewAdded?: () => void
}

export function ReviewInput({
  businessId,
  businessName,
  onReviewAdded,
}: ReviewInputProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      source: 'google',
      review_date: new Date().toISOString().split('T')[0],
    },
  })

  const selectedRating = watch('rating')
  const selectedSource = watch('source')

  // Fetch existing reviews
  const fetchReviews = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/leads/${businessId}/reviews`)
      const data = await response.json()
      setReviews(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load reviews on mount
  useState(() => {
    fetchReviews()
  })

  const onSubmit = async (data: ReviewFormData) => {
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/leads/${businessId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to add review')
      }

      // Reset form and refresh reviews
      reset({
        rating: 5,
        source: 'google',
        review_date: new Date().toISOString().split('T')[0],
      })
      await fetchReviews()
      onReviewAdded?.()
    } catch (error) {
      console.error('Error adding review:', error)
      alert('Failed to add review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return

    try {
      const response = await fetch(`/api/leads/${businessId}/reviews/${reviewId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete review')
      }

      await fetchReviews()
      onReviewAdded?.()
    } catch (error) {
      console.error('Error deleting review:', error)
      alert('Failed to delete review')
    }
  }

  // Rating display helper
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-gray-300'
        }`}
      />
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          Qualifying Reviews
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Add reviews for {businessName} to qualify this lead
        </p>
      </div>

      {/* Add Review Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Review</CardTitle>
          <CardDescription>
            Enter review details manually or paste from source
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reviewer_name">
                  Reviewer Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="reviewer_name"
                  {...register('reviewer_name')}
                  disabled={isSubmitting}
                  placeholder="John Doe"
                />
                {errors.reviewer_name && (
                  <p className="text-sm text-red-600">
                    {errors.reviewer_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="review_date">Review Date</Label>
                <Input
                  id="review_date"
                  type="date"
                  {...register('review_date')}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rating">
                  Rating <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedRating?.toString()}
                  onValueChange={(value) =>
                    setValue('rating', parseInt(value))
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <SelectItem key={rating} value={rating.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{rating}</span>
                          <div className="flex">{renderStars(rating)}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.rating && (
                  <p className="text-sm text-red-600">{errors.rating.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={selectedSource}
                  onValueChange={(value) => setValue('source', value as any)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="yelp">Yelp</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review_text">
                Review Text <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="review_text"
                rows={4}
                {...register('review_text')}
                disabled={isSubmitting}
                placeholder="Enter the full review text..."
              />
              {errors.review_text && (
                <p className="text-sm text-red-600">
                  {errors.review_text.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="response_text">
                Business Response{' '}
                <span className="text-sm text-gray-500">(optional)</span>
              </Label>
              <Textarea
                id="response_text"
                rows={2}
                {...register('response_text')}
                disabled={isSubmitting}
                placeholder="If the business responded to this review, enter it here..."
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Adding Review...' : 'Add Review'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Reviews List */}
      <div>
        <h4 className="text-sm font-semibold mb-3">
          Added Reviews ({reviews.length})
        </h4>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No reviews added yet. Add your first review above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{review.reviewer_name}</span>
                        <div className="flex">{renderStars(review.rating)}</div>
                        <Badge variant="secondary" className="text-xs">
                          {review.source}
                        </Badge>
                        {review.review_date && (
                          <span className="text-sm text-gray-500">
                            {new Date(review.review_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        {review.review_text}
                      </p>
                      {review.response_text && (
                        <div className="mt-2 pl-4 border-l-2 border-blue-500">
                          <p className="text-xs font-medium text-blue-600 mb-1">
                            Business Response:
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {review.response_text}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(review.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
