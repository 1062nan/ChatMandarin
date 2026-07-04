/**
 * Supabase 客户端（浏览器端）
 * 用于 Client Components
 */
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/db/types'

export function createSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 单例（避免每次 render 都创建新实例）
let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createSupabaseClient()
  }
  return client
}
