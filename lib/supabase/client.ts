/**
 * Supabase 客户端（浏览器端）
 * 用于 Client Components
 */
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createSupabaseClient()
  }
  return client
}
