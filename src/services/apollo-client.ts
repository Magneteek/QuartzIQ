/**
 * Apollo.io API Client
 *
 * Handles integration with Apollo.io People Search and Enrichment APIs
 * Optimized for finding 1 executive per business (Owner/CEO/Managing Director)
 *
 * API Documentation:
 * - Search: https://docs.apollo.io/reference/people-search
 * - Enrichment: https://docs.apollo.io/reference/people-enrichment
 * - Bulk Enrichment: https://docs.apollo.io/reference/bulk-people-enrichment
 */

import axios, { AxiosInstance } from 'axios';

// Types based on Apollo API documentation
export interface ApolloSearchParams {
  q_organization_domains_list?: string[];
  person_titles?: string[];
  person_seniorities?: string[];
  per_page?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  email: string | null;
  phone_numbers: Array<{ raw_number: string; sanitized_number: string }>;
  linkedin_url: string | null;
  seniority: string;
  organization?: {
    name: string;
    website_url: string;
    primary_domain: string;
  };
}

export interface ApolloSearchResponse {
  breadcrumbs: any[];
  partial_results_only: boolean;
  disable_eu_prospecting: boolean;
  partial_results_limit: number;
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
  contacts: any[];
  people: ApolloPerson[];
  accounts: any[];
}

export interface ApolloEnrichParams {
  first_name: string;
  last_name: string;
  domain?: string;
  organization_name?: string;
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
}

export interface ApolloEnrichResponse {
  person: ApolloPerson;
}

export interface ApolloBulkEnrichParams {
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
  details: Array<{
    first_name: string;
    last_name: string;
    domain?: string;
    organization_name?: string;
  }>;
}

export interface ApolloBulkEnrichResponse {
  matches: ApolloPerson[];
}

export interface ApolloAPIUsage {
  endpoint: 'search' | 'enrich' | 'bulk_enrich';
  creditsUsed: number;
  costUsd: number;
  success: boolean;
  durationMs: number;
  errorMessage?: string;
}

/**
 * Apollo.io API Client
 * Handles rate limiting, error handling, and cost tracking
 */
export class ApolloClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL = 'https://api.apollo.io/api/v1';
  private requestCount = 0;
  private estimatedCreditCost = 0.10; // $0.10 per API call (estimate)

  // Rate limiting (free tier: 100 calls/month)
  private monthlyLimit: number;
  private currentMonthCalls = 0;

  constructor(apiKey: string, monthlyLimit: number = 100) {
    if (!apiKey) {
      throw new Error('Apollo API key is required');
    }

    this.apiKey = apiKey;
    this.monthlyLimit = monthlyLimit;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': this.apiKey,
      },
      timeout: 30000, // 30 second timeout
    });

    // Response interceptor for logging and rate limiting
    this.client.interceptors.response.use(
      (response) => {
        this.requestCount++;
        this.currentMonthCalls++;
        return response;
      },
      (error) => {
        this.requestCount++;
        this.currentMonthCalls++;
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if we're within rate limits
   */
  private checkRateLimit(): void {
    if (this.currentMonthCalls >= this.monthlyLimit) {
      throw new Error(
        `Apollo API monthly limit reached: ${this.currentMonthCalls}/${this.monthlyLimit} calls`
      );
    }
  }

  /**
   * Get current API usage statistics
   */
  public getUsageStats() {
    return {
      totalRequests: this.requestCount,
      monthlyCallsUsed: this.currentMonthCalls,
      monthlyLimit: this.monthlyLimit,
      remainingCalls: this.monthlyLimit - this.currentMonthCalls,
      utilizationPercent: Math.round((this.currentMonthCalls / this.monthlyLimit) * 100),
    };
  }

  /**
   * Reset monthly call counter (call this at the start of each month)
   */
  public resetMonthlyCounter(): void {
    this.currentMonthCalls = 0;
  }

  /**
   * Search for people by company domain
   * Returns basic info (name, title, LinkedIn) but NO emails/phones
   *
   * @param domain - Company domain (e.g., "abcdental.nl")
   * @param targetCount - Number of executives to find (default: 1)
   * @returns Array of ApolloPerson (without contact details)
   */
  async searchPeopleByDomain(
    domain: string,
    targetCount: number = 1
  ): Promise<{ people: ApolloPerson[]; usage: ApolloAPIUsage }> {
    this.checkRateLimit();

    const startTime = Date.now();
    const params: ApolloSearchParams = {
      q_organization_domains_list: [domain],
      person_titles: [
        'Owner',
        'Co-Owner',
        'CEO',
        'Chief Executive Officer',
        'Founder',
        'Co-Founder',
        'Managing Director',
        'Director',
        'President',
        'Eigenaar', // Dutch for Owner
        'Directeur', // Dutch for Director
      ],
      person_seniorities: ['owner', 'founder', 'c_suite', 'director'],
      per_page: Math.min(targetCount * 2, 10), // Get a few more than needed
    };

    try {
      const response = await this.client.post<ApolloSearchResponse>(
        '/mixed_people/search',
        params
      );

      const durationMs = Date.now() - startTime;
      const people = response.data.people || [];

      // Sort by seniority (owners/founders first)
      const sortedPeople = this.sortBySeniority(people);
      const topPeople = sortedPeople.slice(0, targetCount);

      const usage: ApolloAPIUsage = {
        endpoint: 'search',
        creditsUsed: topPeople.length,
        costUsd: topPeople.length * this.estimatedCreditCost,
        success: true,
        durationMs,
      };

      return { people: topPeople, usage };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const usage: ApolloAPIUsage = {
        endpoint: 'search',
        creditsUsed: 0,
        costUsd: 0,
        success: false,
        durationMs,
        errorMessage: error.message || 'Unknown error',
      };

      console.error('Apollo search error:', error.response?.data || error.message);
      return { people: [], usage };
    }
  }

  /**
   * Enrich a single person with email and phone
   * Requires name and company info from previous search or Claude research
   *
   * @param params - Person identification details
   * @returns Enriched person with email and phone
   */
  async enrichPerson(
    params: ApolloEnrichParams
  ): Promise<{ person: ApolloPerson | null; usage: ApolloAPIUsage }> {
    this.checkRateLimit();

    const startTime = Date.now();
    const enrichParams = {
      ...params,
      reveal_personal_emails: true,
      reveal_phone_number: true,
    };

    try {
      const response = await this.client.post<ApolloEnrichResponse>(
        '/people/match',
        enrichParams
      );

      const durationMs = Date.now() - startTime;
      const person = response.data.person;

      const usage: ApolloAPIUsage = {
        endpoint: 'enrich',
        creditsUsed: 1,
        costUsd: this.estimatedCreditCost,
        success: true,
        durationMs,
      };

      return { person, usage };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const usage: ApolloAPIUsage = {
        endpoint: 'enrich',
        creditsUsed: 0,
        costUsd: 0,
        success: false,
        durationMs,
        errorMessage: error.message || 'Unknown error',
      };

      console.error('Apollo enrichment error:', error.response?.data || error.message);
      return { person: null, usage };
    }
  }

  /**
   * Bulk enrich up to 10 people at once (more efficient)
   *
   * @param people - Array of person identification details (max 10)
   * @returns Array of enriched people
   */
  async bulkEnrichPeople(
    people: Array<{ firstName: string; lastName: string; domain?: string; companyName?: string }>
  ): Promise<{ enriched: ApolloPerson[]; usage: ApolloAPIUsage }> {
    this.checkRateLimit();

    if (people.length === 0) {
      return {
        enriched: [],
        usage: {
          endpoint: 'bulk_enrich',
          creditsUsed: 0,
          costUsd: 0,
          success: true,
          durationMs: 0,
        },
      };
    }

    if (people.length > 10) {
      console.warn('Bulk enrich limited to 10 people, truncating...');
      people = people.slice(0, 10);
    }

    const startTime = Date.now();
    const params: ApolloBulkEnrichParams = {
      reveal_personal_emails: true,
      reveal_phone_number: true,
      details: people.map((p) => ({
        first_name: p.firstName,
        last_name: p.lastName,
        domain: p.domain,
        organization_name: p.companyName,
      })),
    };

    try {
      const response = await this.client.post<ApolloBulkEnrichResponse>(
        '/people/bulk_match',
        params
      );

      const durationMs = Date.now() - startTime;
      const enriched = response.data.matches || [];

      const usage: ApolloAPIUsage = {
        endpoint: 'bulk_enrich',
        creditsUsed: enriched.length,
        costUsd: enriched.length * this.estimatedCreditCost,
        success: true,
        durationMs,
      };

      return { enriched, usage };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const usage: ApolloAPIUsage = {
        endpoint: 'bulk_enrich',
        creditsUsed: 0,
        costUsd: 0,
        success: false,
        durationMs,
        errorMessage: error.message || 'Unknown error',
      };

      console.error('Apollo bulk enrichment error:', error.response?.data || error.message);
      return { enriched: [], usage };
    }
  }

  /**
   * Helper: Sort people by seniority (owners/founders first)
   */
  private sortBySeniority(people: ApolloPerson[]): ApolloPerson[] {
    const seniorityOrder: Record<string, number> = {
      owner: 1,
      founder: 2,
      c_suite: 3,
      director: 4,
      vp: 5,
      manager: 6,
      senior: 7,
      entry: 8,
    };

    return people.sort((a, b) => {
      const aScore = seniorityOrder[a.seniority?.toLowerCase()] || 99;
      const bScore = seniorityOrder[b.seniority?.toLowerCase()] || 99;
      return aScore - bScore;
    });
  }

  /**
   * Helper: Extract domain from website URL
   */
  public static extractDomain(website: string): string {
    if (!website) return '';
    return website
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .split('/')[0]
      .toLowerCase();
  }

  /**
   * Helper: Format phone number for display
   */
  public static formatPhoneNumber(phoneNumbers: ApolloPerson['phone_numbers']): string | null {
    if (!phoneNumbers || phoneNumbers.length === 0) return null;
    return phoneNumbers[0].sanitized_number || phoneNumbers[0].raw_number;
  }
}

export default ApolloClient;
