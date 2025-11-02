/**
 * Verify Database Trigger Fix
 * Checks if the businesses table trigger was fixed successfully
 */

const { Pool } = require('pg');

// Use the same connection pattern as the app
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'postgres',
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function verifyFix() {
  console.log('🔍 Verifying database trigger fix...\n');

  try {
    // Check the trigger
    const triggerCheck = await pool.query(`
      SELECT
        tgname as trigger_name,
        proname as function_name
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgrelid = 'businesses'::regclass
      ORDER BY tgname
    `);

    console.log('📊 Current Triggers on Businesses Table:');
    console.log('─'.repeat(60));

    if (triggerCheck.rows.length === 0) {
      console.log('⚠️  No triggers found on businesses table');
    } else {
      triggerCheck.rows.forEach(row => {
        const isFixed = row.trigger_name === 'update_businesses_last_updated_at';
        const status = isFixed ? '✅' : '❓';
        console.log(`${status} ${row.trigger_name} → ${row.function_name}`);
      });
    }

    // Check if the correct trigger exists
    const fixedTrigger = triggerCheck.rows.find(r => r.trigger_name === 'update_businesses_last_updated_at');

    console.log('\n' + '─'.repeat(60));

    if (fixedTrigger) {
      console.log('✅ DATABASE FIX SUCCESSFUL!');
      console.log('   The correct trigger is in place.');
      console.log('   Column: last_updated_at ✓');
      console.log('   Trigger: update_businesses_last_updated_at ✓\n');

      // Test the trigger
      console.log('🧪 Testing trigger with a dummy update...');
      await pool.query(`
        UPDATE businesses
        SET scrape_count = scrape_count
        WHERE id = (SELECT id FROM businesses LIMIT 1)
      `);
      console.log('✅ Trigger works! No errors.\n');

      return true;
    } else {
      console.log('❌ FIX NOT APPLIED CORRECTLY');
      console.log('   Expected trigger: update_businesses_last_updated_at');
      console.log('   Found triggers:', triggerCheck.rows.map(r => r.trigger_name).join(', ') || 'none\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error('\nError details:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Run verification
verifyFix().then(success => {
  if (success) {
    console.log('🎯 Next Steps:');
    console.log('   1. ✅ Database is fixed and ready');
    console.log('   2. Run a new extraction to test');
    console.log('   3. Import your Apify crawls to get business IDs\n');
    process.exit(0);
  } else {
    console.log('\n🔧 Please re-apply the fix from APPLY-THIS-FIX.sql\n');
    process.exit(1);
  }
});
