import { createSupabaseServerClient } from '@/lib/supabase/server'
import { HSKKClient } from '@/components/hskk/hskk-client'
import { HSKK_CONTENT } from '@/lib/hskk/content'

export const metadata = { title: 'HSKK Mock Test' }

export default async function HSKKPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return <HSKKClient tests={HSKK_CONTENT} />
}
