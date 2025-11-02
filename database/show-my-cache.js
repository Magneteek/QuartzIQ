/**
 * Show What's In My Cache
 * Simple script to see your cached businesses
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function showMyCache() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('\n💾 YOUR BUSINESS CACHE CONTENTS\n');
    console.log('═'.repeat(60));

    // Overall size
    const total = await pool.query('SELECT COUNT(*) as count FROM businesses');
    console.log(`\n📊 Total Businesses: ${total.rows[0].count.toLocaleString()}`);
    console.log(`💰 Cache Value: $${(total.rows[0].count * 0.03).toFixed(2)}`);

    // Top categories
    console.log('\n📁 Top 10 Categories:');
    console.log('─'.repeat(60));
    const categories = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM businesses
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `);
    categories.rows.forEach((r, idx) => {
      const bar = '█'.repeat(Math.floor(r.count / 50));
      console.log(`${String(idx + 1).padStart(2)}. ${r.category.padEnd(35)} ${String(r.count).padStart(5)} ${bar}`);
    });

    // Top cities
    console.log('\n🏙️  Top 10 Cities:');
    console.log('─'.repeat(60));
    const cities = await pool.query(`
      SELECT city, COUNT(*) as count
      FROM businesses
      GROUP BY city
      ORDER BY count DESC
      LIMIT 10
    `);
    cities.rows.forEach((r, idx) => {
      const bar = '█'.repeat(Math.floor(r.count / 20));
      console.log(`${String(idx + 1).padStart(2)}. ${r.city.padEnd(35)} ${String(r.count).padStart(5)} ${bar}`);
    });

    // Sample Amsterdam dentists
    console.log('\n🦷 Sample: Amsterdam Dentists (Your Biggest Cache Category)');
    console.log('─'.repeat(60));
    const dentists = await pool.query(`
      SELECT name, address, rating, reviews_count
      FROM businesses
      WHERE city ILIKE '%Amsterdam%'
        AND category ILIKE '%tandarts%'
      ORDER BY rating DESC, reviews_count DESC
      LIMIT 5
    `);
    dentists.rows.forEach((b, idx) => {
      console.log(`${idx + 1}. ${b.name}`);
      console.log(`   📍 ${b.address}`);
      console.log(`   ⭐ ${b.rating}★ (${b.reviews_count} reviews)\n`);
    });

    // Cache value by category
    console.log('💵 Cache Value by Top Categories:');
    console.log('─'.repeat(60));
    const values = await pool.query(`
      SELECT
        category,
        COUNT(*) as count,
        (COUNT(*) * 0.03) as value_usd
      FROM businesses
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    `);
    values.rows.forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.category}: $${r.value_usd.toFixed(2)} (${r.count} businesses)`);
    });

    console.log('\n═'.repeat(60));
    console.log('\n✅ This is YOUR cached data ready to use!');
    console.log('\n💡 How to use it:');
    console.log('   1. Make API request to /api/extract-optimized');
    console.log('   2. System checks cache first (FREE)');
    console.log('   3. Only calls Apify for missing businesses (PAID)');
    console.log('\n🚀 Example API call:');
    console.log('   curl -X POST http://localhost:3000/api/extract-optimized \\');
    console.log('     -H "X-API-Key: quartziq_..." \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"category":"tandarts","location":"Amsterdam","businessLimit":10}\'');
    console.log('\n📖 Read more: /database/HOW-TO-USE-CACHE.md\n');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Database connection cooling down from import.');
      console.log('    Wait 30 seconds and try again.\n');
    } else {
      console.error('\n❌ Error:', error.message);
    }
  } finally {
    await pool.end();
  }
}

showMyCache();
