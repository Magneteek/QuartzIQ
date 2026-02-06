import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth']

// Define role-based route access
const roleBasedRoutes = {
  admin: ['/dashboard', '/dashboard/users', '/dashboard/settings'],
  va: ['/dashboard', '/dashboard/leads', '/dashboard/qualified-reviews', '/dashboard/customers', '/dashboard/monitoring'],
  enrichment: ['/dashboard', '/dashboard/enrichment', '/dashboard/customers', '/dashboard/monitoring'],
  viewer: ['/dashboard', '/dashboard/crawl-manager', '/dashboard/qualified-reviews'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow all API routes to pass through - they handle their own authentication
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Get JWT token (doesn't require database, works in Edge Runtime)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Check if user is authenticated
  if (!token) {
    // Redirect to login with callback URL
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check role-based access
  const userRole = token.role as string

  if (!userRole) {
    // No role assigned, redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin has access to everything
  if (userRole === 'admin') {
    return NextResponse.next()
  }

  // Check if user's role has access to this route
  const allowedRoutes = roleBasedRoutes[userRole as keyof typeof roleBasedRoutes] || []
  const hasAccess = allowedRoutes.some(route => pathname.startsWith(route))

  if (!hasAccess) {
    // Redirect to their default dashboard
    return NextResponse.redirect(new URL('/dashboard/crawl-manager', request.url))
  }

  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
