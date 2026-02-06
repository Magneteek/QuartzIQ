'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type UserRole = 'admin' | 'va' | 'enrichment' | 'viewer'

interface RequireRoleProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
}

export function RequireRole({ children, allowedRoles, fallback }: RequireRoleProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    const userRole = session.user?.role

    if (!userRole || !allowedRoles.includes(userRole)) {
      router.push('/dashboard/crawl-manager')
    }
  }, [session, status, allowedRoles, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const userRole = session.user?.role

  if (!userRole || !allowedRoles.includes(userRole)) {
    return fallback || null
  }

  return <>{children}</>
}
