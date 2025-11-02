#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function debugCategories() {
  console.log('\n📊 Checking categories for Amsterdam businesses...\n');

  try {
    // Check what categories exist for Amsterdam
    const result = await pool.query(`
      SELECT
        category,
        city,
        COUNT(*) as count
      FROM businesses
      WHERE LOWER(city) LIKE '%amsterdam%' OR LOWER(address) LIKE '%amsterdam%'
      GROUP BY category, city
      ORDER BY count DESC
    `);

    console.log('Categories found in database for Amsterdam:');
    console.log('================================================');
    result.rows.forEach(row => {
      console.log(`Category: "${row.category}" | City: "${row.city}" | Count: ${row.count}`);
    });

    // Check if any insurance-related categories exist
    console.log('\n\n🔍 Checking for insurance-related categories...\n');
    const insuranceResult = await pool.query(`
      SELECT
        category,
        city,
        COUNT(*) as count
      FROM businesses
      WHERE (
        LOWER(category) LIKE '%insurance%'
        OR LOWER(category) LIKE '%verzekering%'
        OR LOWER(category) LIKE '%assur%'
      )
      AND (LOWER(city) LIKE '%amsterdam%' OR LOWER(address) LIKE '%amsterdam%')
      GROUP BY category, city
      ORDER BY count DESC
    `);

    if (insuranceResult.rows.length > 0) {
      console.log('Insurance-related categories found:');
      console.log('====================================');
      insuranceResult.rows.forEach(row => {
        console.log(`Category: "${row.category}" | City: "${row.city}" | Count: ${row.count}`);
      });
    } else {
      console.log('❌ No insurance-related categories found for Amsterdam');
    }

    // Test the exact query the API uses
    console.log('\n\n🧪 Testing API query with "Insurance Agency" and "Amsterdam"...\n');
    const apiTestResult = await pool.query(`
      SELECT
        COUNT(*) as cached_count
      FROM businesses
      WHERE
        (LOWER(category) LIKE LOWER($1) OR LOWER(category) LIKE LOWER($2))
        AND (LOWER(city) LIKE LOWER($3) OR LOWER(address) LIKE LOWER($3))
    `, [
      '%Insurance Agency%',
      'Insurance Agency',
      '%Amsterdam%'
    ]);

    console.log(`API Query Result: ${apiTestResult.rows[0].cached_count} businesses found`);

    // Show sample businesses
    if (parseInt(apiTestResult.rows[0].cached_count) > 0) {
      const sampleResult = await pool.query(`
        SELECT name, category, city, address
        FROM businesses
        WHERE
          (LOWER(category) LIKE LOWER($1) OR LOWER(category) LIKE LOWER($2))
          AND (LOWER(city) LIKE LOWER($3) OR LOWER(address) LIKE LOWER($3))
        LIMIT 5
      `, [
        '%Insurance Agency%',
        'Insurance Agency',
        '%Amsterdam%'
      ]);

      console.log('\nSample businesses:');
      sampleResult.rows.forEach(b => {
        console.log(`- ${b.name} | ${b.category} | ${b.city}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugCategories();
