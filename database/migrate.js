/**
 * Database Migration Script
 * Runs the schema.sql file to create all tables
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'quartziq_reviews',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
  });

  try {
    console.log('🚀 Starting database migration...\n');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');

    console.log('📄 Executing schema.sql...');
    await pool.query(schemaSql);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Created tables:');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    tables.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
    });

    console.log(`\n✨ Total tables: ${tables.rows.length}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function rollback() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'quartziq_reviews',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
  });

  try {
    console.log('⚠️  Rolling back database...\n');

    // Drop all tables
    const dropSql = `
      DROP TABLE IF EXISTS extraction_reviews CASCADE;
      DROP TABLE IF EXISTS extraction_businesses CASCADE;
      DROP TABLE IF EXISTS contact_enrichments CASCADE;
      DROP TABLE IF EXISTS api_usage_log CASCADE;
      DROP TABLE IF EXISTS subscription_history CASCADE;
      DROP TABLE IF EXISTS extractions CASCADE;
      DROP TABLE IF EXISTS monitoring_configs CASCADE;
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS businesses CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;

      DROP FUNCTION IF EXISTS generate_business_fingerprint;
      DROP FUNCTION IF EXISTS find_duplicate_business;
      DROP FUNCTION IF EXISTS update_updated_at_column;
      DROP FUNCTION IF EXISTS auto_generate_fingerprint;
    `;

    await pool.query(dropSql);

    console.log('✅ Rollback completed - all tables dropped');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// CLI
const command = process.argv[2];

if (command === 'rollback') {
  rollback();
} else {
  migrate();
}
