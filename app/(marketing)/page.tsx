import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function MarketingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 已登录用户跳转到 dashboard
  if (user) {
    redirect('/dashboard')
  }

  // 未登录用户跳转到现有 Landing Page（已部署在 chatmandarin.cc 根路径）
  // 如果 Landing Page 部署在 Cloudflare Pages 的同一个项目根目录，
  // 那 Next.js 的 / 路由会覆盖它
  // 这里做简单跳转到 signup
  redirect('/signup')
}
