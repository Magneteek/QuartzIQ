/**
 * Run Migration 014: Add Apify Leads Cost Tracking
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('🚀 Running Migration 014: Add Apify Leads Cost Tracking\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/014_add_apify_leads_cost.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(sql);

    console.log('\n✅ Migration 014 completed successfully!');
    console.log('\nChanges:');
    console.log('  • Added apify_leads_cost column to contact_enrichments');
    console.log('  • Added apify_only to reveal_method enum');
    console.log('  • Created index for cost analysis');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
