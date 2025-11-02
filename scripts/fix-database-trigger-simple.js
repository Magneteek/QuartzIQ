/**
 * Fix Database Trigger - Simple Version
 * Uses existing db.js connection
 */

const { db } = require('../database/db');

async function fixTrigger() {
  console.log('🔧 Fixing businesses table trigger...\n');

  try {
    // Drop the existing incorrect trigger
    console.log('1️⃣ Dropping old trigger...');
    await db.query(`DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses`);
    console.log('   ✅ Old trigger dropped\n');

    // Create the correct function
    console.log('2️⃣ Creating new trigger function...');
    await db.query(`
      CREATE OR REPLACE FUNCTION update_businesses_last_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.last_updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ Function created\n');

    // Apply the corrected trigger
    console.log('3️⃣ Creating new trigger...');
    await db.query(`
      CREATE TRIGGER update_businesses_last_updated_at BEFORE UPDATE ON businesses
          FOR EACH ROW EXECUTE FUNCTION update_businesses_last_updated_at();
    `);
    console.log('   ✅ Trigger created\n');

    // Verify
    console.log('4️⃣ Verifying trigger...');
    const result = await db.query(`
      SELECT
        tgname as trigger_name,
        proname as function_name
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgrelid = 'businesses'::regclass
    `);

    if (result.rows.length > 0) {
      console.log('   ✅ Trigger configured:');
      result.rows.forEach(row => {
        console.log(`      - ${row.trigger_name} → ${row.function_name}`);
      });
    }

    console.log('\n✅ DATABASE TRIGGER FIXED SUCCESSFULLY!\n');
    console.log('🎯 Next Steps:');
    console.log('   1. Restart your QuartzIQ server');
    console.log('   2. Run a new extraction');
    console.log('   3. Businesses should now cache properly!\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the fix
fixTrigger();
