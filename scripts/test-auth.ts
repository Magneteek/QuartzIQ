import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testAuth() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  })

  try {
    console.log('🔍 Checking admin user...\n')

    // Check if user exists
    const result = await pool.query(
      'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
      ['admin@quartziq.com']
    )

    if (result.rows.length === 0) {
      console.log('❌ Admin user not found!')
      console.log('Creating admin user...\n')

      // Create admin user
      const passwordHash = await bcrypt.hash('AdminPassword123!', 10)

      const insertResult = await pool.query(
        `INSERT INTO users (email, name, password_hash, role, email_verified)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING id, email, name, role`,
        ['admin@quartziq.com', 'System Administrator', passwordHash, 'admin']
      )

      console.log('✅ Admin user created:')
      console.log(insertResult.rows[0])
      console.log('\nCredentials:')
      console.log('Email: admin@quartziq.com')
      console.log('Password: AdminPassword123!')
    } else {
      const user = result.rows[0]
      console.log('✅ Admin user found:')
      console.log({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      })

      // Test password
      console.log('\n🔐 Testing password...')
      const passwordMatch = await bcrypt.compare('AdminPassword123!', user.password_hash)

      if (passwordMatch) {
        console.log('✅ Password is correct!')
      } else {
        console.log('❌ Password does not match!')
        console.log('Updating password...\n')

        const newPasswordHash = await bcrypt.hash('AdminPassword123!', 10)
        await pool.query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [newPasswordHash, 'admin@quartziq.com']
        )

        console.log('✅ Password updated successfully!')
      }
    }

    console.log('\n📋 Environment check:')
    console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Not set')
    console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '❌ Not set')
    console.log('POSTGRES_HOST:', process.env.POSTGRES_HOST || '❌ Not set')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

testAuth()
