import NextAuth, { DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import { z } from "zod"

// Extend the built-in session type to include role
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "admin" | "va" | "enrichment" | "viewer"
    } & DefaultSession["user"]
  }

  interface User {
    role: "admin" | "va" | "enrichment" | "viewer"
  }
}

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

// Login schema validation
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  // No adapter needed for JWT strategy
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          // Validate credentials
          const { email, password } = loginSchema.parse(credentials)

          // Query user from database
          const result = await pool.query(
            'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
            [email]
          )

          const user = result.rows[0]

          if (!user) {
            return null
          }

          // Verify password
          const passwordMatch = await bcrypt.compare(password, user.password_hash)

          if (!passwordMatch) {
            return null
          }

          // Return user object (without password)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Add role to token on sign in
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      // Add role and id to session
      if (session.user) {
        session.user.role = token.role as "admin" | "va" | "enrichment" | "viewer"
        session.user.id = token.id as string
      }
      return session
    },
  },
})
