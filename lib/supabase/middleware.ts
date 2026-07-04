/**
 * Supabase Middleware 客户端
 * 用于刷新 Auth Session
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/db/types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  // 重要：不要在 createServerClient 和 supabase.auth.getUser() 之间放任何代码
  // 它可能轻易地引入一个 debug 顺序错误，导致用户被错误地 sign out
  const {
    data: { user }
  } = await supabase.auth.getUser()

  // 不保护 /api/auth（避免循环重定向）
  // 不保护 (marketing) 和 (auth)
  const { pathname } = request.nextUrl
  const isProtected = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/conversation') ||
    pathname.startsWith('/hskk') ||
    pathname.startsWith('/shadowing') ||
    pathname.startsWith('/dubbing') ||
    pathname.startsWith('/mistakes') ||
    pathname.startsWith('/settings')

  if (!user && isProtected) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
