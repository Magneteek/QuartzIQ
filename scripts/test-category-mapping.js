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

// Copy of the TypeScript mapping logic
const CATEGORY_MAPPINGS = [
  {
    englishId: 'insurance_agency',
    dutchCategories: [
      'Verzekeringsagentschap',
      'Verzekeringsmakelaar',
      'Verzekeringsmaatschappij',
      'Autoverzekering',
      'Ziektekostenverzekeraar',
      'Tussenpersoon voor levensverzekeringen',
      'Tussenpersoon voor woningverzekering'
    ],
    searchTerms: ['verzekering', 'insurance', 'assur']
  }
];

function generateCategoryWhereClause(category, paramOffset = 1) {
  const mapping = CATEGORY_MAPPINGS.find(m => m.englishId === category);

  if (!mapping) {
    return {
      clause: `(LOWER(category) LIKE LOWER($${paramOffset}) OR LOWER(category) LIKE LOWER($${paramOffset + 1}))`,
      params: [`%${category}%`, category]
    };
  }

  const conditions = [];
  const params = [];
  let currentParam = paramOffset;

  // Add exact Dutch category matches
  mapping.dutchCategories.forEach(dutchCat => {
    conditions.push(`LOWER(category) = LOWER($${currentParam})`);
    params.push(dutchCat);
    currentParam++;
  });

  // Add search term LIKE queries
  mapping.searchTerms.forEach(term => {
    conditions.push(`LOWER(category) LIKE LOWER($${currentParam})`);
    params.push(`%${term}%`);
    currentParam++;
  });

  return {
    clause: `(${conditions.join(' OR ')})`,
    params
  };
}

async function testMapping() {
  console.log('\n🧪 Testing Category Mapping for "insurance_agency" + "Amsterdam"\n');

  const category = 'insurance_agency';
  const location = 'Amsterdam';

  // Generate WHERE clause
  const { clause: categoryClause, params: categoryParams } = generateCategoryWhereClause(category, 1);
  const locationParam = categoryParams.length + 1;
  const allParams = [...categoryParams, `%${location}%`];

  console.log('Generated SQL:');
  console.log('=============');
  console.log('Category Clause:', categoryClause);
  console.log('Parameters:', allParams);
  console.log();

  const countQuery = `
    SELECT COUNT(*) as cached_count
    FROM businesses
    WHERE
      ${categoryClause}
      AND (LOWER(city) LIKE LOWER($${locationParam}) OR LOWER(address) LIKE LOWER($${locationParam}))
  `;

  console.log('Full Query:');
  console.log('===========');
  console.log(countQuery);
  console.log();

  try {
    const result = await pool.query(countQuery, allParams);
    const cachedCount = result.rows[0].cached_count;

    console.log(`✅ SUCCESS! Found ${cachedCount} businesses`);

    if (cachedCount > 0) {
      // Get sample businesses
      const sampleQuery = `
        SELECT name, category, city, address
        FROM businesses
        WHERE
          ${categoryClause}
          AND (LOWER(city) LIKE LOWER($${locationParam}) OR LOWER(address) LIKE LOWER($${locationParam}))
        LIMIT 5
      `;

      const sampleResult = await pool.query(sampleQuery, allParams);

      console.log('\nSample businesses:');
      console.log('==================');
      sampleResult.rows.forEach(b => {
        console.log(`- ${b.name} | ${b.category} | ${b.city}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testMapping();
