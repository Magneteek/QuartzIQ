/**
 * Fix Database Trigger
 * Standalone script to fix the businesses table trigger
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixTrigger() {
  console.log('🔧 Fixing businesses table trigger...\n');

  try {
    // Step 1: Drop old trigger
    console.log('1️⃣ Dropping old trigger...');
    await pool.query(`DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses`);
    console.log('   ✅ Done\n');

    // Step 2: Create new function
    console.log('2️⃣ Creating trigger function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_businesses_last_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.last_updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ Done\n');

    // Step 3: Create new trigger
    console.log('3️⃣ Creating trigger...');
    await pool.query(`
      CREATE TRIGGER update_businesses_last_updated_at BEFORE UPDATE ON businesses
          FOR EACH ROW EXECUTE FUNCTION update_businesses_last_updated_at();
    `);
    console.log('   ✅ Done\n');

    // Step 4: Verify
    console.log('4️⃣ Verifying...');
    const result = await pool.query(`
      SELECT tgname, proname
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgrelid = 'businesses'::regclass
    `);

    console.log('   ✅ Triggers:');
    result.rows.forEach(row => {
      console.log(`      ${row.tgname} → ${row.proname}`);
    });

    console.log('\n✅ DATABASE FIXED!\n');
    console.log('Next: Run a new extraction to test\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixTrigger();
