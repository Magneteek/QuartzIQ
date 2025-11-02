/**
 * Verify Organizations Created Successfully
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyOrganizations() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('\n🔍 Verifying Organizations in Database...\n');

    const result = await pool.query(`
      SELECT
        id,
        name,
        slug,
        subscription_tier,
        monthly_extraction_limit,
        subscription_status,
        LEFT(api_key, 25) || '...' as api_key_preview,
        created_at
      FROM organizations
      ORDER BY name
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No organizations found in database');
      return;
    }

    console.log(`✅ Found ${result.rows.length} organizations:\n`);

    result.rows.forEach((org, idx) => {
      console.log(`${idx + 1}. ${org.name}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Slug: ${org.slug}`);
      console.log(`   Tier: ${org.subscription_tier}`);
      console.log(`   Status: ${org.subscription_status}`);
      console.log(`   Monthly Limit: ${org.monthly_extraction_limit} extractions`);
      console.log(`   API Key: ${org.api_key_preview}`);
      console.log(`   Created: ${org.created_at.toISOString()}`);
      console.log();
    });

    console.log('✨ Database verification complete!\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyOrganizations();
