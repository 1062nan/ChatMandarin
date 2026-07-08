import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppNavbar } from '@/components/layout/app-navbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('auth_id', user.id)
    .single()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', profile?.id)
    .eq('status', 'active')
    .maybeSingle()

  const plan = (subscription?.plan as 'free' | 'plus' | 'pro') || 'free'

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar plan={plan} />
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
          {children}
        </div>
      </main>
    </div>
  )
}
