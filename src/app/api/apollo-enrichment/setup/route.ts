/**
 * Apollo Enrichment Setup API
 *
 * POST /api/apollo-enrichment/setup
 * Applies the database migration for Apollo enrichment
 *
 * This endpoint can be called once to set up the database schema.
 * Safe to call multiple times - will report if objects already exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting Apollo enrichment setup...');

    // Initialize database connection
    const db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });

    // Test connection
    try {
      await db.query('SELECT NOW()');
      console.log('✅ Database connected');
    } catch (error: any) {
      console.error('❌ Database connection failed:', error.message);
      return NextResponse.json(
        {
          success: false,
          error: 'Database connection failed',
          detail: error.message,
        },
        { status: 500 }
      );
    }

    // Read migration file
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', '003_apollo_contact_enrichment.sql');

    let sql: string;
    try {
      sql = fs.readFileSync(migrationPath, 'utf8');
      console.log('✅ Migration file loaded');
    } catch (error: any) {
      console.error('❌ Failed to read migration file:', error.message);
      return NextResponse.json(
        {
          success: false,
          error: 'Migration file not found',
          detail: error.message,
        },
        { status: 500 }
      );
    }

    // Execute migration
    try {
      console.log('⚡ Executing migration...');
      await db.query(sql);
      console.log('✅ Migration executed successfully');
    } catch (error: any) {
      console.error('❌ Migration execution failed:', error.message);

      // Check if it's just because objects already exist
      if (error.message.includes('already exists') || error.code === '42P07') {
        return NextResponse.json({
          success: true,
          message: 'Migration already applied',
          detail: 'Database objects already exist. This is normal if you\'ve run setup before.',
          alreadyApplied: true,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Migration failed',
          detail: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    // Verify created objects
    const verificationResults = {
      tables: [],
      functions: [],
      views: [],
    };

    // Check tables
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('enrichment_queue', 'apollo_api_log')
      ORDER BY table_name
    `);
    verificationResults.tables = tables.rows.map(r => r.table_name);

    // Check contact_enrichments columns
    const columns = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'contact_enrichments'
      AND column_name IN ('apollo_person_id', 'apollo_search_cost', 'apollo_enrich_cost', 'reveal_method', 'title', 'seniority')
      ORDER BY column_name
    `);

    // Check functions
    const functions = await db.query(`
      SELECT proname as function_name
      FROM pg_proc
      WHERE proname IN ('get_enrichment_stats', 'get_next_enrichment_job')
      ORDER BY proname
    `);
    verificationResults.functions = functions.rows.map(r => r.function_name);

    // Check views
    const views = await db.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name IN ('enrichment_queue_detailed', 'apollo_api_usage_summary')
      ORDER BY table_name
    `);
    verificationResults.views = views.rows.map(r => r.table_name);

    await db.end();

    console.log('✅ Setup complete!');
    console.log(`   Tables created: ${verificationResults.tables.length}`);
    console.log(`   Functions created: ${verificationResults.functions.length}`);
    console.log(`   Views created: ${verificationResults.views.length}`);
    console.log(`   contact_enrichments extended: ${columns.rows.length}/6 Apollo fields`);

    return NextResponse.json({
      success: true,
      message: 'Apollo enrichment setup completed successfully',
      verification: {
        tables: verificationResults.tables,
        functions: verificationResults.functions,
        views: verificationResults.views,
        contact_enrichments_apollo_fields: columns.rows.map(r => r.column_name),
      },
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Also support GET to check setup status
export async function GET(request: NextRequest) {
  try {
    const db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });

    // Check if migration is applied
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('enrichment_queue', 'apollo_api_log')
    `);

    const columns = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'contact_enrichments'
      AND column_name IN ('apollo_person_id', 'apollo_search_cost', 'apollo_enrich_cost', 'reveal_method')
    `);

    const functions = await db.query(`
      SELECT proname as function_name
      FROM pg_proc
      WHERE proname IN ('get_enrichment_stats', 'get_next_enrichment_job')
    `);

    await db.end();

    const isSetupComplete =
      tables.rows.length === 2 &&
      columns.rows.length >= 4 &&
      functions.rows.length === 2;

    return NextResponse.json({
      success: true,
      setupComplete: isSetupComplete,
      status: {
        tables: {
          expected: 2,
          found: tables.rows.length,
          items: tables.rows.map(r => r.table_name),
        },
        contact_enrichments_apollo_fields: {
          expected: 6,
          found: columns.rows.length,
          items: columns.rows.map(r => r.column_name),
        },
        functions: {
          expected: 2,
          found: functions.rows.length,
          items: functions.rows.map(r => r.function_name),
        },
      },
      message: isSetupComplete
        ? 'Apollo enrichment is set up and ready to use'
        : 'Setup incomplete - run POST /api/apollo-enrichment/setup to apply migration',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
