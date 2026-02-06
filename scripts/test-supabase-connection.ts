/**
 * Test Supabase Database Connection
 * Checks connection and shows what's in the database
 */

import { db } from '../database/db';

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...\n');

    // Test basic connection
    const result = await db.query('SELECT NOW() as current_time');
    console.log('✅ Connection successful!');
    console.log(`📅 Database time: ${result.rows[0].current_time}\n`);

    // Check what tables exist
    console.log('📊 Checking existing tables...\n');
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('Tables found:');
    tables.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });
    console.log('');

    // Check businesses table
    if (tables.rows.some(r => r.table_name === 'businesses')) {
      const businessCount = await db.query('SELECT COUNT(*) as count FROM businesses');
      console.log(`📍 Businesses table: ${businessCount.rows[0].count} records\n`);

      // Show sample columns
      const columns = await db.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'businesses'
        ORDER BY ordinal_position
        LIMIT 20;
      `);

      console.log('Sample columns in businesses table:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      console.log('');

      // Show sample business
      const sample = await db.query('SELECT * FROM businesses LIMIT 1');
      if (sample.rows.length > 0) {
        console.log('Sample business record:');
        console.log(JSON.stringify(sample.rows[0], null, 2));
      }
    }

    // Check reviews table
    if (tables.rows.some(r => r.table_name === 'reviews')) {
      const reviewCount = await db.query('SELECT COUNT(*) as count FROM reviews');
      console.log(`\n⭐ Reviews table: ${reviewCount.rows[0].count} records`);
    }

    // Check for migration tracking table
    if (tables.rows.some(r => r.table_name === 'schema_migrations')) {
      const migrations = await db.query('SELECT * FROM schema_migrations ORDER BY version');
      console.log('\n📋 Applied migrations:');
      migrations.rows.forEach(m => {
        console.log(`  - ${m.version}`);
      });
    } else {
      console.log('\n⚠️  No migration tracking table found');
    }

    await db.close();
    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
