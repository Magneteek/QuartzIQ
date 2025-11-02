/**
 * Fix Database Trigger - Businesses Table
 *
 * Issue: The update trigger tries to set NEW.updated_at but the table has last_updated_at
 * Fix: Create a new trigger function that uses the correct column name
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE || 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixTrigger() {
  console.log('🔧 Fixing businesses table trigger...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'fix-businesses-trigger.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Migration Details:');
    console.log(`   File: ${migrationPath}`);
    console.log(`   Database: ${pool.options.host}:${pool.options.port}/${pool.options.database}\n`);

    // Execute the migration
    console.log('🚀 Applying migration...\n');

    const result = await pool.query(migration);

    console.log('✅ Migration applied successfully!\n');

    // Verify the trigger
    console.log('📊 Verifying trigger...');
    const verifyResult = await pool.query(`
      SELECT
        tgname as trigger_name,
        proname as function_name
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgrelid = 'businesses'::regclass
    `);

    if (verifyResult.rows.length > 0) {
      console.log('\n✅ Trigger configured:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.trigger_name} → ${row.function_name}`);
      });
    }

    console.log('\n🎯 Next Steps:');
    console.log('   1. The database trigger is now fixed');
    console.log('   2. Restart your QuartzIQ server (npm run dev)');
    console.log('   3. Run a new extraction to test');
    console.log('   4. Businesses should now cache properly!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixTrigger();
