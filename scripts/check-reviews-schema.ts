import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function checkSchema() {
  const result = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'reviews'
    ORDER BY ordinal_position
  `)

  console.log('Reviews table columns:')
  result.rows.forEach(row => console.log(`  - ${row.column_name} (${row.data_type})`))

  await pool.end()
}

checkSchema()
