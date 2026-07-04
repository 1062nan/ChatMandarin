import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppNavbar } from '@/components/layout/app-navbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 获取用户 profile + subscription
  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('*').eq('auth_id', user.id).single(),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', (await supabase.from('profiles').select('id').eq('auth_id', user.id).single()).data?.id)
      .eq('status', 'active')
      .single()
  ])

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
          {children}
        </div>
      </main>
    </div>
  )
}
