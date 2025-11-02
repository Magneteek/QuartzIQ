#!/usr/bin/env node

/**
 * Database Migration Runner
 * Usage: node database/run-migration.js 002_add_crawl_management
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Create database pool
const db = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration(migrationName) {
  try {
    console.log(`\n🔧 Running migration: ${migrationName}\n`);

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', `${migrationName}.sql`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('📊 Executing SQL...\n');
    const result = await db.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');

    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('business_review_crawls', 'crawl_queue')
      ORDER BY table_name;
    `);

    if (tables.rows.length > 0) {
      console.log('✓ Tables created:');
      tables.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // Verify views
    const views = await db.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name IN ('businesses_with_crawl_status', 'active_crawl_batches')
      ORDER BY table_name;
    `);

    if (views.rows.length > 0) {
      console.log('\n✓ Views created:');
      views.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

    // Show statistics
    const crawlCount = await db.query('SELECT COUNT(*) as count FROM business_review_crawls');
    console.log(`\n✓ Backfilled ${crawlCount.rows[0].count} crawl records from existing reviews\n`);

    await db.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    await db.end();
    process.exit(1);
  }
}

// Get migration name from command line
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Usage: node database/run-migration.js <migration_name>');
  console.error('Example: node database/run-migration.js 002_add_crawl_management');
  process.exit(1);
}

runMigration(migrationName);
