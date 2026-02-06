import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireRoleAPI } from '@/lib/auth-helpers'

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(['admin', 'va', 'enrichment', 'viewer']),
})

// GET /api/users - List all users (admin only)
export async function GET() {
  try {
    // Check if user is admin
    const { error } = await requireRoleAPI(['admin'])
    if (error) return error

    const result = await pool.query(
      'SELECT id, email, name, role, created_at, last_login_at as last_login FROM users ORDER BY created_at DESC'
    )

    return NextResponse.json({ users: result.rows })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const { error } = await requireRoleAPI(['admin'])
    if (error) return error

    const body = await request.json()
    const { email, name, password, role } = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, email_verified)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING id, email, name, role, created_at`,
      [email, name, passwordHash, role]
    )

    return NextResponse.json({
      message: 'User created successfully',
      user: result.rows[0],
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
