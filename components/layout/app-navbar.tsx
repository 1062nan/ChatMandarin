'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Mic, ClipboardList, BookOpen, Settings, LogOut, Menu, X, Repeat, Film } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conversation/restaurant', label: 'Practice', icon: Mic },
  { href: '/shadowing', label: 'Shadowing', icon: Repeat },
  { href: '/hskk', label: 'HSKK Mock', icon: ClipboardList },
  { href: '/dubbing', label: 'Dubbing', icon: Film },
  { href: '/mistakes', label: 'Mistakes', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings }
]

export function AppNavbar({ plan = 'free' }: { plan?: 'free' | 'plus' | 'pro' }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = getSupabaseClient()

  const planBadge = {
    free: { label: 'Free', cls: 'bg-muted text-muted-foreground' },
    plus: { label: 'Plus', cls: 'bg-vermilion/15 text-vermilion' },
    pro: { label: 'Pro', cls: 'bg-gold/20 text-gold' },
  }[plan]

  async function handleSignOut() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard">
            <img src="/logo.svg" alt="ChatMandarin" className="h-7 w-auto" />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-vermilion/10 text-vermilion'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <Link
            href="/settings"
            className="mb-2 flex items-center justify-between rounded-md px-3 py-2 text-xs hover:bg-accent"
          >
            <span className="text-muted-foreground">Plan</span>
            <span className={cn('rounded-full px-2 py-0.5 font-medium', planBadge.cls)}>
              {planBadge.label}
            </span>
          </Link>
          {plan === 'free' && (
            <Link
              href="/settings"
              className="mb-2 block rounded-md bg-vermilion/10 px-3 py-2 text-center text-xs font-medium text-vermilion hover:bg-vermilion/20"
            >
              ⚡ Upgrade to Plus
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-4 md:hidden">
        <Link href="/dashboard">
          <img src="/logo.svg" alt="ChatMandarin" className="h-6 w-auto" />
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1 px-3 py-16">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                      isActive
                        ? 'bg-vermilion/10 text-vermilion'
                        : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
              <button
                onClick={() => {
                  setMobileOpen(false)
                  handleSignOut()
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
