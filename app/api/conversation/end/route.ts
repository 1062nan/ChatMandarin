/**
 * POST /api/conversation/end
 * 结束对话，更新用户统计（total_conversations, streak）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { endConversation } from '@/lib/db/conversations'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversation_id } = await request.json()

    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
    }

    await endConversation(conversation_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('End conversation failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
