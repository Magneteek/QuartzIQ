  import { NextResponse } from 'next/server'
  import type { NextRequest } from 'next/server'
  import { getToken } from 'next-auth/jwt'

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth', '/']  // Added / here

  // Define role-based route access
  const roleBasedRoutes = {
    admin: ['/dashboard', '/dashboard/users', '/dashboard/settings'],
    va: ['/dashboard', '/dashboard/leads', '/dashboard/qualified-reviews', '/dashboard/customers', '/dashboard/monitoring'],
    enrichment: ['/dashboard', '/dashboard/enrichment', '/dashboard/customers', '/dashboard/monitoring'],
    viewer: ['/dashboard', '/dashboard/crawl-manager', '/dashboard/qualified-reviews'],
  }

  export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Allow all API routes to pass through
    if (pathname.startsWith('/api/')) {
      return NextResponse.next()
    }

    // Check if route is public
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

    if (isPublicRoute) {
      return NextResponse.next()
    }

    // Get JWT token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    // Check if user is authenticated
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check role-based access
    const userRole = token.role as string

    if (!userRole) {
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
      return NextResponse.redirect(new URL('/dashboard/crawl-manager', request.url))
    }

    return NextResponse.next()
  }

  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  }
