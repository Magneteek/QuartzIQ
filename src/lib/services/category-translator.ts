/**
 * Category Translation Service
 * Translates between English and Dutch business categories
 * Enables cache searches to work with both languages
 */

export interface CategoryTranslation {
  en: string;
  nl: string;
  variations: string[];
}

const CATEGORY_TRANSLATIONS: CategoryTranslation[] = [
  {
    en: 'insurance_agency',
    nl: 'verzekeringsagentschap',
    variations: [
      'insurance', 'verzekering', 'verzekeringsmakelaar', 'verzekeringsmaatschappij',
      'autoverzekering', 'ziektekostenverzekeraar', 'insurance broker', 'insurance company',
      'tussenpersoon voor levensverzekeringen', 'tussenpersoon voor woningverzekering'
    ]
  },
  {
    en: 'dentist',
    nl: 'tandarts',
    variations: ['dental', 'tandartspraktijk', 'dental clinic', 'tandheelkunde']
  },
  {
    en: 'doctor',
    nl: 'dokter',
    variations: ['physician', 'huisarts', 'arts', 'general practitioner', 'gp']
  },
  {
    en: 'physiotherapist',
    nl: 'fysiotherapeut',
    variations: ['physical therapy', 'fysiotherapiepraktijk', 'physiotherapy']
  },
  {
    en: 'dental laboratory',
    nl: 'tandtechnisch laboratorium',
    variations: ['dental lab', 'tandtechniek']
  },
  {
    en: 'doctor',
    nl: 'dokter',
    variations: ['physician', 'huisarts', 'arts', 'general practitioner']
  },
  {
    en: 'pharmacy',
    nl: 'apotheek',
    variations: ['apotheke', 'drugstore']
  },
  {
    en: 'restaurant',
    nl: 'restaurant',
    variations: ['eetcafe', 'bistro']
  },
  {
    en: 'hotel',
    nl: 'hotel',
    variations: ['accommodation', 'accommodatie']
  },
  {
    en: 'gym',
    nl: 'sportschool',
    variations: ['fitness', 'fitness center', 'fitnesscentrum']
  },
  {
    en: 'lawyer',
    nl: 'advocaat',
    variations: ['attorney', 'legal', 'juridisch advies']
  },
  {
    en: 'accountant',
    nl: 'accountant',
    variations: ['boekhouder', 'bookkeeper', 'administratiekantoor']
  },
  {
    en: 'real_estate_agency',
    nl: 'makelaardij',
    variations: ['real estate', 'makelaar', 'hypotheek', 'vastgoedadviseur', 'huurwoningen']
  },
  {
    en: 'financial_advisor',
    nl: 'financieel adviseur',
    variations: ['financial planner', 'financieel planner', 'financiële instelling']
  }
];

export class CategoryTranslator {
  /**
   * Translate category from English to Dutch
   */
  static toDutch(englishCategory: string): string | null {
    const normalized = englishCategory.toLowerCase().trim();

    const translation = CATEGORY_TRANSLATIONS.find(
      t => t.en.toLowerCase() === normalized ||
           t.variations.some(v => v.toLowerCase() === normalized)
    );

    return translation?.nl || null;
  }

  /**
   * Translate category from Dutch to English
   */
  static toEnglish(dutchCategory: string): string | null {
    const normalized = dutchCategory.toLowerCase().trim();

    const translation = CATEGORY_TRANSLATIONS.find(
      t => t.nl.toLowerCase() === normalized ||
           t.variations.some(v => v.toLowerCase() === normalized)
    );

    return translation?.en || null;
  }

  /**
   * Get all possible variations of a category for cache search
   * Returns array of terms to search for in any language
   */
  static getAllVariations(category: string): string[] {
    const normalized = category.toLowerCase().trim();
    const variations: string[] = [normalized]; // Include original

    const translation = CATEGORY_TRANSLATIONS.find(
      t => t.en.toLowerCase() === normalized ||
           t.nl.toLowerCase() === normalized ||
           t.variations.some(v => v.toLowerCase() === normalized)
    );

    if (translation) {
      variations.push(translation.en);
      variations.push(translation.nl);
      variations.push(...translation.variations);
    }

    // Remove duplicates and return
    return [...new Set(variations)];
  }

  /**
   * Detect if category is likely Dutch or English
   */
  static detectLanguage(category: string): 'nl' | 'en' | 'unknown' {
    const normalized = category.toLowerCase().trim();

    const isDutch = CATEGORY_TRANSLATIONS.some(t => t.nl.toLowerCase() === normalized);
    const isEnglish = CATEGORY_TRANSLATIONS.some(t => t.en.toLowerCase() === normalized);

    if (isDutch) return 'nl';
    if (isEnglish) return 'en';
    return 'unknown';
  }

  /**
   * Translate category to target language for cache search
   * Prefers Dutch for database searches (as most data is in Dutch)
   */
  static normalizeForCache(category: string): string {
    const dutch = this.toDutch(category);
    return dutch || category; // Return Dutch version or original if not found
  }

  /**
   * Add a new translation dynamically
   */
  static addTranslation(translation: CategoryTranslation): void {
    const exists = CATEGORY_TRANSLATIONS.some(
      t => t.en.toLowerCase() === translation.en.toLowerCase() ||
           t.nl.toLowerCase() === translation.nl.toLowerCase()
    );

    if (!exists) {
      CATEGORY_TRANSLATIONS.push(translation);
      console.log(`✅ Added translation: ${translation.en} ↔ ${translation.nl}`);
    }
  }

  /**
   * Get all available translations (for debugging/UI)
   */
  static getAllTranslations(): CategoryTranslation[] {
    return CATEGORY_TRANSLATIONS;
  }
}
