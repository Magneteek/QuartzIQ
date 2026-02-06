/**
 * Check Supabase Database Schema
 * Shows tables, columns, and migration status
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkSchema() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('🔍 Checking Supabase database schema...\n');
    console.log(`📡 Connected to: ${process.env.POSTGRES_HOST}`);
    console.log(`🗄️  Database: ${process.env.POSTGRES_DATABASE}\n`);

    // Check tables
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📊 Tables found:');
    tables.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });
    console.log('');

    // Check businesses table columns
    if (tables.rows.some(r => r.table_name === 'businesses')) {
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'businesses'
        ORDER BY ordinal_position;
      `);

      console.log('📋 Businesses table columns:');
      columns.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)';
        console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}`);
      });
      console.log('');

      // Count records
      const count = await pool.query('SELECT COUNT(*) FROM businesses');
      console.log(`📍 Total businesses: ${count.rows[0].count}\n`);
    }

    // Check reviews table
    if (tables.rows.some(r => r.table_name === 'reviews')) {
      const reviewCount = await pool.query('SELECT COUNT(*) FROM reviews');
      console.log(`⭐ Total reviews: ${reviewCount.rows[0].count}\n`);
    }

    // Check for lifecycle tracking columns (from migration 006)
    const lifecycleCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'businesses'
        AND column_name IN ('lifecycle_stage', 'is_paying_customer', 'monitoring_enabled');
    `);

    if (lifecycleCheck.rows.length > 0) {
      console.log('✅ Customer lifecycle tracking columns found:');
      lifecycleCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}`);
      });
      console.log('');
    }

    // Check for enrichment columns (from migration 005)
    const enrichmentCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'businesses'
        AND column_name IN ('enrichment_status', 'owner_name', 'owner_email');
    `);

    if (enrichmentCheck.rows.length > 0) {
      console.log('✅ Enrichment columns found:');
      enrichmentCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}`);
      });
      console.log('');
    }

    // Check for cache optimization columns (from migration 013)
    const cacheCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'businesses'
        AND column_name IN ('place_id_source', 'times_reused', 'cache_savings_usd', 'ghl_sent');
    `);

    if (cacheCheck.rows.length > 0) {
      console.log('✅ Cache optimization columns found:');
      cacheCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}`);
      });
      console.log('');
    } else {
      console.log('⚠️  Cache optimization columns NOT found (migration 013 not applied)\n');
    }

    // Check for lead qualification columns (from migration 008)
    const leadCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'businesses'
        AND column_name IN ('va_notes', 'qualification_date', 'ready_for_enrichment');
    `);

    if (leadCheck.rows.length > 0) {
      console.log('✅ Lead qualification columns found:');
      leadCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}`);
      });
      console.log('');
    } else {
      console.log('⚠️  Lead qualification columns NOT found (migration 008 not applied)\n');
    }

    console.log('✅ Schema check complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
