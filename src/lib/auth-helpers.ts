import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

type UserRole = 'admin' | 'va' | 'enrichment' | 'viewer'

/**
 * Get the current session (server-side)
 */
export async function getCurrentSession() {
  const session = await auth()
  return session
}

/**
 * Require authentication - redirect to login if not authenticated
 * For use in server components and pages
 */
export async function requireAuth() {
  const session = await getCurrentSession()

  if (!session?.user) {
    redirect('/login')
  }

  return session
}

/**
 * Require specific role - redirect if user doesn't have required role
 * For use in server components and pages
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireAuth()

  const userRole = session.user?.role

  if (!userRole || !allowedRoles.includes(userRole)) {
    redirect('/dashboard/crawl-manager')
  }

  return session
}

/**
 * Require authentication for API routes
 * Returns NextResponse with 401 error if not authenticated
 */
export async function requireAuthAPI() {
  const session = await getCurrentSession()

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
      session: null
    }
  }

  return { error: null, session }
}

/**
 * Require specific role for API routes
 * Returns NextResponse with 401/403 error if unauthorized
 */
export async function requireRoleAPI(allowedRoles: UserRole[]) {
  const session = await getCurrentSession()

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
      session: null
    }
  }

  const userRole = session.user?.role

  if (!userRole || !allowedRoles.includes(userRole)) {
    return {
      error: NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      ),
      session: null
    }
  }

  return { error: null, session }
}

/**
 * Check if user has a specific role (returns boolean)
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const session = await getCurrentSession()
  return session?.user?.role === role
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  const session = await getCurrentSession()
  return !!session?.user?.role && roles.includes(session.user.role)
}

/**
 * Get user role (or null if not authenticated)
 */
export async function getUserRole(): Promise<UserRole | null> {
  const session = await getCurrentSession()
  return session?.user?.role || null
}
