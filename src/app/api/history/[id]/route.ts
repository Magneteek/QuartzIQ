import { NextRequest, NextResponse } from 'next/server'
import { HistoryManager } from '../../../../lib/history-manager'

const historyManager = new HistoryManager()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Extraction ID is required' },
        { status: 400 }
      )
    }

    const extraction = await historyManager.loadExtraction(id)

    if (!extraction) {
      return NextResponse.json(
        { success: false, error: 'Extraction not found' },
        { status: 404 }
      )
    }

    // Transform data to frontend format if needed
    if (extraction.results) {
      // Transform businesses
      if (extraction.results.businesses) {
        extraction.results.businesses = extraction.results.businesses.map((b: any) => ({
          ...b,
          title: b.title || b.name,
          placeId: b.placeId || b.place_id,
          totalScore: b.totalScore || b.rating || 0,
          reviewsCount: b.reviewsCount || b.reviews_count || 0,
          categoryName: b.categoryName || b.category || 'Unknown',
          url: b.url || b.google_maps_url
        }))
      }

      // Transform reviews
      if (extraction.results.reviews) {
        extraction.results.reviews = extraction.results.reviews.map((r: any) => ({
          ...r,
          reviewId: r.reviewId || r.review_id,
          name: r.name || r.reviewer_name,
          stars: r.stars !== undefined ? r.stars : r.rating,
          publishedAtDate: r.publishedAtDate || r.published_date || r.publishAt,
          originalLanguage: r.originalLanguage || r.language || 'unknown',
          // Keep business info
          title: r.title || r.business_name,
          placeId: r.placeId || r.place_id,
          totalScore: r.totalScore || r.business_rating
        }))
      }
    }

    return NextResponse.json({ success: true, data: extraction })

  } catch (error: any) {
    console.error(`History load error for ${params.id}:`, error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}