/**
 * POST /api/admin/generate
 * 管理员专用：批量生成内容（场景/跟读句/配音/HSKK）
 *
 * Header: x-admin-token: ADMIN_TOKEN
 * Body: { type: 'scenario'|'shadowing'|'dubbing', hsk_level, count, options }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generateScenario, generateShadowingSentences, generateDubbingClip } from '@/lib/ai/content-generator'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // 管理员鉴权
  const token = request.headers.get('x-admin-token')
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createSupabaseServerClient()

  try {
    const body = await request.json()
    const { type, hsk_level, count, options } = body
    const hskLevel = hsk_level || 3
    const results: any[] = []

    switch (type) {
      case 'scenario': {
        const n = count || 5
        for (let i = 0; i < n; i++) {
          try {
            const scenario = await generateScenario(hskLevel, options?.theme)
            const { data, error } = await supabase
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
                sort_order: 100 + i
              })
              .select()
              .single()
            if (!error && data) results.push(data)
          } catch (e) { console.error('Scenario gen failed:', e) }
        }
        return NextResponse.json({ generated: results.length, scenarios: results })
      }

      case 'shadowing': {
        const n = count || 10
        const sentences = await generateShadowingSentences(hskLevel, options?.category || 'daily', n)
        const records = sentences.map((s: any, i: number) => ({
          id: `gen-${hskLevel}-${options?.category || 'daily'}-${Date.now()}-${i}`,
          text_zh: s.text_zh,
          text_pinyin: s.text_pinyin,
          text_en: s.text_en,
          hsk_level: s.hsk_level || hskLevel,
          category: s.category || options?.category || 'daily',
          difficulty: s.difficulty || 'easy',
          duration_seconds: 5,
          is_active: true,
          sort_order: 200 + i
        }))
        const { data, error } = await supabase.from('shadowing_sentences').insert(records).select()
        return NextResponse.json({ generated: data?.length || 0, sentences: data })
      }

      case 'dubbing': {
        const n = count || 3
        for (let i = 0; i < n; i++) {
          try {
            const clip = await generateDubbingClip(hskLevel, options?.difficulty || 'medium')
            const { data, error } = await supabase
              .from('dubbing_clips')
              .insert({
                id: `gen-dub-${Date.now()}-${i}`,
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
            if (!error && data) results.push(data)
          } catch (e) { console.error('Dubbing gen failed:', e) }
        }
        return NextResponse.json({ generated: results.length, clips: results })
      }

      default:
        return NextResponse.json({ error: 'Invalid type. Use: scenario, shadowing, or dubbing' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin generation failed:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
