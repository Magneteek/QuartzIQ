import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { UserMenu } from '@/components/auth/user-menu'
import Link from 'next/link'
import {
  Users,
  Target,
  History,
  Settings,
  ListChecks,
  UserCheck,
  Clock,
  Mail,
  Bell,
  Building2,
  Search,
} from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const navigation = [
    { name: 'Discovery', href: '/', icon: Search, roles: ['admin', 'va'] },
    { name: 'Leads', href: '/dashboard/leads', icon: UserCheck, roles: ['admin', 'va'] },
    { name: 'Qualified Reviews', href: '/dashboard/qualified-reviews', icon: ListChecks, roles: ['admin', 'va'] },
    { name: 'Enrichment', href: '/dashboard/enrichment', icon: Mail, roles: ['admin', 'enrichment'] },
    { name: 'Customers', href: '/dashboard/customers', icon: Building2, roles: ['admin', 'va', 'enrichment'] },
    { name: 'Monitoring', href: '/dashboard/monitoring', icon: Bell, roles: ['admin', 'va', 'enrichment'] },
    { name: 'Crawl Manager', href: '/dashboard/crawl-manager', icon: Target, roles: ['admin'] },
    { name: 'Crawl Queue', href: '/dashboard/crawl-queue', icon: Clock, roles: ['admin'] },
    { name: 'Crawl History', href: '/dashboard/crawl-history', icon: History, roles: ['admin'] },
    { name: 'Users', href: '/dashboard/users', icon: Users, roles: ['admin'] },
  ]

  const userRole = session.user.role as string

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(userRole)
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard/leads" className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  QuartzIQ
                </Link>
              </div>

              {/* Navigation Links */}
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                {filteredNavigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center">
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="py-6">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
