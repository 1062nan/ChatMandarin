/**
 * POST /api/generate
 * AI 动态内容生成（场景/跟读句/配音/HSKK）
 *
 * Body: { type: 'scenario'|'shadowing'|'dubbing'|'hskk', hsk_level, options }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generateScenario, generateShadowingSentences, generateDubbingClip, generateHSKKTest } from '@/lib/ai/content-generator'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, hsk_level')
      .eq('auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const body = await request.json()
    const { type, hsk_level, options } = body
    const hskLevel = hsk_level || profile.hsk_level || 3

    switch (type) {
      case 'scenario': {
        const scenario = await generateScenario(hskLevel, options?.theme)

        // 存数据库
        const { data: saved, error } = await supabase
          .from('scenarios')
          .insert({
            id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            recommended_hsk: scenario.recommended_hsk,
            duration_minutes: scenario.duration_minutes,
            ai_persona: scenario.ai_persona,
            scenario_prompt: scenario.scenario_prompt,
            goals: scenario.goals,
            completion_criteria: scenario.completion_criteria,
            is_active: true,
            sort_order: 100
          })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ scenario: saved })
      }

      case 'shadowing': {
        const sentences = await generateShadowingSentences(hskLevel, options?.category || 'daily', options?.count || 5)

        const records = sentences.map((s: any, i: number) => ({
          id: `gen-${Date.now()}-${i}`,
          text_zh: s.text_zh,
          text_pinyin: s.text_pinyin,
          text_en: s.text_en,
          hsk_level: s.hsk_level || hskLevel,
          category: s.category || options?.category || 'daily',
          difficulty: s.difficulty || 'easy',
          duration_seconds: 5,
          is_active: true,
          sort_order: 100 + i
        }))

        const { data: saved, error } = await supabase
          .from('shadowing_sentences')
          .insert(records)
          .select()

        if (error) throw error
        return NextResponse.json({ sentences: saved })
      }

      case 'dubbing': {
        const clip = await generateDubbingClip(hskLevel, options?.difficulty || 'medium')

        const { data: saved, error } = await supabase
          .from('dubbing_clips')
          .insert({
            id: `gen-${Date.now()}`,
            title: clip.title,
            category: 'original',
            description: clip.description,
            duration_seconds: clip.duration_seconds || 40,
            hsk_level: clip.hsk_level || hskLevel,
            difficulty: clip.difficulty || 'medium',
            lines: clip.lines,
            is_active: true
          })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ clip: saved })
      }

      case 'hskk': {
        const test = await generateHSKKTest(options?.level || 'intermediate')
        return NextResponse.json({ test })
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Content generation failed:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
