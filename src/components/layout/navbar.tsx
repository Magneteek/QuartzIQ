'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Search,
  Users,
  Bell,
  UserPlus,
  BarChart3,
  Settings,
  MoreHorizontal,
  Star,
  History,
  Target,
  List,
  FolderKanban,
  ChevronDown,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const navigation = [
  { name: 'Find Businesses', href: '/', icon: MapPin },
  { name: 'Leads', href: '/dashboard/leads', icon: UserPlus },
  { name: 'Enrichment', href: '/dashboard/enrichment', icon: BarChart3 },
  { name: 'Customers', href: '/dashboard/customers', icon: Users },
  { name: 'Alerts', href: '/dashboard/monitoring', icon: Bell },
]

export function Navbar() {
  const pathname = usePathname()

  const morePages = [
    { name: 'Review Scraper', href: '/dashboard/crawl-manager', icon: FolderKanban },
    { name: 'Review Queue', href: '/dashboard/crawl-queue', icon: List },
    { name: 'Scrape Targets', href: '/dashboard/crawl-targets', icon: Target },
    { name: 'Scrape History', href: '/dashboard/crawl-history', icon: History },
    { name: 'Qualified Reviews', href: '/dashboard/qualified-reviews', icon: Star },
  ]

  const isCrawlPageActive = morePages.some(
    page => pathname.startsWith(page.href)
  )

  const handleOpenSettings = () => {
    window.dispatchEvent(new Event('openSettings'))
  }

  return (
    <nav className="border-b border-border bg-background sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Q</span>
            </div>
            <span className="font-semibold text-lg hidden sm:inline">QuartzIQ</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))
              const Icon = item.icon

              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      isActive && 'bg-primary text-primary-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.name}</span>
                  </Button>
                </Link>
              )
            })}

            {/* Crawl Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={isCrawlPageActive ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-1',
                    isCrawlPageActive && 'bg-primary text-primary-foreground'
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">More</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {morePages.map((page) => {
                  const Icon = page.icon
                  return (
                    <Link key={page.name} href={page.href}>
                      <DropdownMenuItem>
                        <Icon className="h-4 w-4 mr-2" />
                        {page.name}
                      </DropdownMenuItem>
                    </Link>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenSettings}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
