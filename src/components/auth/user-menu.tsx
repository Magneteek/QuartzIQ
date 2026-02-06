'use client'

import { useSession, signOut } from 'next-auth/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Settings } from 'lucide-react'

export function UserMenu() {
  const { data: session } = useSession()

  if (!session?.user) {
    return null
  }

  const { name, email, role } = session.user

  // Get initials from name
  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || email?.[0]?.toUpperCase() || '?'

  // Role badge colors
  const roleColors = {
    admin: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
    va: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
    enrichment: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
    viewer: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30',
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session.user.image || undefined} alt={name || ''} />
            <AvatarFallback className="bg-blue-600 text-white text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">{email}</p>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${roleColors[role] || roleColors.viewer}`}>
                {role?.toUpperCase()}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        {role === 'admin' && (
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-600 dark:text-red-400"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
