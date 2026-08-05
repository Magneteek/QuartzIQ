/**
 * Roast Pipeline — Stage 1 Qualifier
 *
 * Pure SQL filters over data already sitting in `businesses` — no external
 * API calls. Three buckets:
 *   - no website:  website IS NULL                         → skip straight to outreach
 *   - unclaimed:   is_claimed = false                       → skip straight to outreach
 *   - has website: website IS NOT NULL, never audited       → stage 3 (staleness) candidates
 *
 * Scoped to lifecycle_stage = 'prospect' so existing leads/customers are
 * never accidentally targeted with a cold "roast".
 */

import { Pool } from 'pg';

export interface RoastCandidate {
  id: string;
  place_id: string;
  name: string;
  website: string | null;
  is_claimed: boolean | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country_code: string | null;
  rating: number | null;
  reviews_count: number | null;
}

export interface RoastSummary {
  noWebsite: number;
  unclaimed: number;
  unclaimedUnknown: number; // is_claimed IS NULL — not yet backfilled
  hasWebsiteUnaudited: number;
}

const CANDIDATE_FIELDS = `
  id, place_id, name, website, is_claimed, phone, address, city, country_code, rating, reviews_count
`;

const BASE_FILTERS = `
  status = 'active'
  AND permanently_closed = false
  AND lifecycle_stage = 'prospect'
`;

export class RoastQualifier {
  private db: Pool;

  constructor() {
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
  }

  async getNoWebsite(limit = 100): Promise<RoastCandidate[]> {
    const { rows } = await this.db.query(
      `SELECT ${CANDIDATE_FIELDS} FROM businesses
       WHERE ${BASE_FILTERS} AND website IS NULL
       ORDER BY reviews_count DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async getUnclaimed(limit = 100): Promise<RoastCandidate[]> {
    const { rows } = await this.db.query(
      `SELECT ${CANDIDATE_FIELDS} FROM businesses
       WHERE ${BASE_FILTERS} AND is_claimed = false
       ORDER BY reviews_count DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  /** Businesses with a website that have never been through stage 3/4 auditing. */
  async getStage3Candidates(limit = 100): Promise<RoastCandidate[]> {
    const { rows } = await this.db.query(
      `SELECT ${CANDIDATE_FIELDS} FROM businesses b
       WHERE ${BASE_FILTERS} AND b.website IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM website_audits wa WHERE wa.business_id = b.id
       )
       ORDER BY reviews_count DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async getSummaryCounts(): Promise<RoastSummary> {
    const { rows } = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE website IS NULL) AS no_website,
        COUNT(*) FILTER (WHERE is_claimed = false) AS unclaimed,
        COUNT(*) FILTER (WHERE is_claimed IS NULL) AS unclaimed_unknown,
        COUNT(*) FILTER (WHERE website IS NOT NULL) AS has_website
      FROM businesses
      WHERE ${BASE_FILTERS}
    `);
    return {
      noWebsite: parseInt(rows[0].no_website, 10),
      unclaimed: parseInt(rows[0].unclaimed, 10),
      unclaimedUnknown: parseInt(rows[0].unclaimed_unknown, 10),
      hasWebsiteUnaudited: parseInt(rows[0].has_website, 10),
    };
  }

  async close() {
    await this.db.end();
  }
}
