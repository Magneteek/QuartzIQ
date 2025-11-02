/**
 * Database Migration Runner
 *
 * Runs SQL migration files using Node.js pg client
 * Usage: node scripts/run-migration.js <migration-file>
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: Migration file path required');
    console.log('Usage: node scripts/run-migration.js <migration-file>');
    console.log('Example: node scripts/run-migration.js database/migrations/003_apollo_contact_enrichment.sql');
    process.exit(1);
  }

  const migrationFile = args[0];
  const migrationPath = path.resolve(process.cwd(), migrationFile);

  // Check if file exists
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  console.log('🚀 Database Migration Runner');
  console.log('='.repeat(60));
  console.log(`📄 Migration file: ${migrationFile}`);
  console.log('');

  // Read migration SQL
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Initialize database connection
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await db.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log('');

    console.log('⚡ Running migration...');
    console.log('─'.repeat(60));

    // Execute migration
    const result = await db.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Results:');
    console.log(`   Commands executed: Multiple`);
    console.log(`   Status: Success`);
    console.log('');

    // Try to get some stats about what was created
    console.log('🔍 Checking created objects...');

    // Check tables
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('enrichment_queue', 'apollo_api_log')
      ORDER BY table_name
    `);

    if (tables.rows.length > 0) {
      console.log('   Tables created:');
      tables.rows.forEach(row => {
        console.log(`     ✓ ${row.table_name}`);
      });
    }

    // Check functions
    const functions = await db.query(`
      SELECT proname as function_name
      FROM pg_proc
      WHERE proname IN ('get_enrichment_stats', 'get_next_enrichment_job')
      ORDER BY proname
    `);

    if (functions.rows.length > 0) {
      console.log('   Functions created:');
      functions.rows.forEach(row => {
        console.log(`     ✓ ${row.function_name}()`);
      });
    }

    // Check views
    const views = await db.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name IN ('enrichment_queue_detailed', 'apollo_api_usage_summary')
      ORDER BY table_name
    `);

    if (views.rows.length > 0) {
      console.log('   Views created:');
      views.rows.forEach(row => {
        console.log(`     ✓ ${row.table_name}`);
      });
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 Migration complete! Your database is ready.');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error('─'.repeat(60));
    console.error('Error message:', error.message || 'Unknown error');
    console.error('Error code:', error.code || 'N/A');
    console.error('Error detail:', error.detail || 'N/A');

    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }

    if (error.message && error.message.includes('already exists')) {
      console.log('');
      console.log('ℹ️  Some objects already exist. This is normal if you\'ve');
      console.log('   run this migration before. The migration will update');
      console.log('   existing objects where possible.');
    }

    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
