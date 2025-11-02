/**
 * Database Connection Checker
 * Tests database connection and checks if migration is needed
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');

async function checkDatabase() {
  console.log('🔍 Database Connection Checker');
  console.log('='.repeat(60));
  console.log('');

  // Try different SSL configurations
  const connectionConfigs = [
    {
      name: 'Default (no SSL rejection)',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Required SSL',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: { required: true, rejectUnauthorized: false }
      }
    },
    {
      name: 'No SSL',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: false
      }
    }
  ];

  let connectedDb = null;

  for (const { name, config } of connectionConfigs) {
    console.log(`📡 Trying connection: ${name}`);

    const db = new Pool(config);

    try {
      const result = await db.query('SELECT NOW(), current_database()');
      console.log('✅ Connection successful!');
      console.log(`   Current time: ${result.rows[0].now}`);
      console.log(`   Database: ${result.rows[0].current_database}`);
      connectedDb = db;
      break;
    } catch (error) {
      console.log(`❌ Failed: ${error.code || error.message}`);
      await db.end();
    }
  }

  if (!connectedDb) {
    console.error('');
    console.error('❌ Could not connect to database with any configuration');
    process.exit(1);
  }

  console.log('');
  console.log('🔍 Checking migration status...');
  console.log('─'.repeat(60));

  try {
    // Check if contact_enrichments table exists
    const tableCheck = await connectedDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'contact_enrichments'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ contact_enrichments table does not exist');
      console.log('   You need to run the base migrations first');
      process.exit(1);
    }

    console.log('✅ contact_enrichments table exists');

    // Check if Apollo fields exist
    const columnsCheck = await connectedDb.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'contact_enrichments'
      AND column_name IN ('apollo_person_id', 'apollo_search_cost', 'apollo_enrich_cost', 'reveal_method')
    `);

    if (columnsCheck.rows.length === 4) {
      console.log('✅ Apollo enrichment fields already exist');
      console.log('   Migration appears to be already applied');
    } else {
      console.log(`⚠️  Only ${columnsCheck.rows.length}/4 Apollo fields found`);
      console.log('   Migration needed');
    }

    // Check enrichment_queue table
    const queueCheck = await connectedDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'enrichment_queue'
      ) as exists
    `);

    if (queueCheck.rows[0].exists) {
      console.log('✅ enrichment_queue table exists');
    } else {
      console.log('❌ enrichment_queue table does not exist');
      console.log('   Migration needed');
    }

    // Check apollo_api_log table
    const logCheck = await connectedDb.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'apollo_api_log'
      ) as exists
    `);

    if (logCheck.rows[0].exists) {
      console.log('✅ apollo_api_log table exists');
    } else {
      console.log('❌ apollo_api_log table does not exist');
      console.log('   Migration needed');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Database check complete!');

  } catch (error) {
    console.error('');
    console.error('❌ Error checking database:', error.message);
    console.error(error.stack);
  } finally {
    await connectedDb.end();
  }
}

checkDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
