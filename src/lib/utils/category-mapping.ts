/**
 * Category Mapping Utility
 *
 * Maps English category labels to Dutch database category names
 * for cache detection queries
 */

interface CategoryMapping {
  englishId: string
  dutchCategories: string[]
  searchTerms: string[]
}

export const CATEGORY_MAPPINGS: CategoryMapping[] = [
  {
    englishId: 'insurance_agency',
    dutchCategories: [
      'Verzekeringsagentschap',
      'Verzekeringsmakelaar',
      'Verzekeringsmaatschappij',
      'Autoverzekering',
      'Ziektekostenverzekeraar',
      'Tussenpersoon voor levensverzekeringen',
      'Tussenpersoon voor woningverzekering'
    ],
    searchTerms: ['verzekering', 'insurance', 'assur']
  },
  {
    englishId: 'dentist',
    dutchCategories: [
      'Tandarts',
      'Tandartspraktijk',
      'Orthodontist',
      'Tandtechnisch laboratorium',
      'mondhygiënist',
      'Cosmetische tandarts',
      'Kaakchirurg',
      'Endodontist',
      'Tandarts voor noodgevallen',
      'Tandenbleekservice',
      'Tandheelkundige opleiding',
      'Tandheelkundige radiologie',
      'Parodontoloog',
      'Parodontoloog voor implantaten',
      'Winkel voor tandheelkundige benodigdheden'
    ],
    searchTerms: ['tand', 'dental', 'orthodont', 'mond']
  },
  {
    englishId: 'physical_therapist',
    dutchCategories: [
      'Fysiotherapeut',
      'Fysiotherapiepraktijk'
    ],
    searchTerms: ['fysio', 'physical therapy', 'therapie']
  },
  {
    englishId: 'real_estate_agency',
    dutchCategories: [
      'Makelaardij',
      'Makelaar',
      'Hypotheek',
      'Vastgoedadviseur',
      'Huurwoningen'
    ],
    searchTerms: ['makelaar', 'hypotheek', 'vastgoed', 'real estate']
  },
  {
    englishId: 'financial_advisor',
    dutchCategories: [
      'Financieel adviseur',
      'Financieel planner',
      'Financiële instelling'
    ],
    searchTerms: ['financieel', 'financial', 'advisor']
  }
]

/**
 * Get Dutch category names for an English category ID
 */
export function getDutchCategories(englishCategoryId: string): string[] {
  const mapping = CATEGORY_MAPPINGS.find(m => m.englishId === englishCategoryId)
  return mapping?.dutchCategories || []
}

/**
 * Get search terms for a category (for LIKE queries)
 */
export function getCategorySearchTerms(englishCategoryId: string): string[] {
  const mapping = CATEGORY_MAPPINGS.find(m => m.englishId === englishCategoryId)
  return mapping?.searchTerms || []
}

/**
 * Generate SQL WHERE clause for category matching
 * Handles both English labels and Dutch database categories
 */
export function generateCategoryWhereClause(
  category: string,
  paramOffset: number = 1
): { clause: string; params: string[] } {
  const dutchCategories = getDutchCategories(category)
  const searchTerms = getCategorySearchTerms(category)

  if (dutchCategories.length === 0 && searchTerms.length === 0) {
    // Fallback: use direct category search
    return {
      clause: `(LOWER(category) LIKE LOWER($${paramOffset}) OR LOWER(category) LIKE LOWER($${paramOffset + 1}))`,
      params: [`%${category}%`, category]
    }
  }

  const conditions: string[] = []
  const params: string[] = []
  let currentParam = paramOffset

  // Always match the English category ID directly (covers non-Dutch databases like Spain)
  conditions.push(`LOWER(category) = LOWER($${currentParam})`)
  params.push(category)
  currentParam++

  // Add exact Dutch category matches
  dutchCategories.forEach(dutchCat => {
    conditions.push(`LOWER(category) = LOWER($${currentParam})`)
    params.push(dutchCat)
    currentParam++
  })

  // Add search term LIKE queries
  searchTerms.forEach(term => {
    conditions.push(`LOWER(category) LIKE LOWER($${currentParam})`)
    params.push(`%${term}%`)
    currentParam++
  })

  return {
    clause: `(${conditions.join(' OR ')})`,
    params
  }
}
