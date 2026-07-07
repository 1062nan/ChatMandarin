'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { Lock, CheckCircle2, Play, Star } from 'lucide-react'
import { toast } from 'sonner'

interface Unit {
  id: string
  hsk_level: number
  unit_number: number
  title: string
  description: string
  difficulty: string
  unlock_score: number
  sort_order: number
  grammar_points?: string[]
  exam_skills?: string[]
}

interface Progress {
  unit_id: string
  status: string
  best_score: number
}

interface JourneyViewProps {
  units: Unit[]
  progress: Progress[]
  displayMode: 'journey' | 'exam'
  profileId: string
}

export function JourneyView({ units, progress, displayMode, profileId }: JourneyViewProps) {
  const supabase = getSupabaseClient()
  const [mode, setMode] = useState(displayMode)
  const [switching, setSwitching] = useState(false)

  const progressMap = new Map<string, Progress>()
  for (const p of progress) progressMap.set(p.unit_id, p)

  // 按章节分组（每 4 个单元一个章节）
  const chapters: Unit[][] = []
  for (let i = 0; i < units.length; i += 4) {
    chapters.push(units.slice(i, i + 4))
  }

  const isExam = mode === 'exam'

  const chapterNames = isExam
    ? ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5']
    : ['第一章：初识中国', '第二章：融入生活', '第三章：职场进阶', '第四章：文化精通', '第五章：巅峰中文']

  async function toggleMode() {
    const newMode = mode === 'journey' ? 'exam' : 'journey'
    setSwitching(true)
    try {
      await supabase
        .from('profiles')
        .update({ display_mode: newMode })
        .eq('id', profileId)
      setMode(newMode)
      toast.success(newMode === 'journey' ? '已切换到故事线模式' : '已切换到 HSK 考试模式')
    } catch {
      toast.error('切换失败')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 模式切换 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {isExam ? '📋 HSK 备考路径' : '🗺️ 中文之旅'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isExam
              ? '严格按 HSK 官方大纲分级训练，显示等级 / 语法点 / 题型'
              : '按生活故事线推进，等级与大纲在后台自动对齐'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={switching}
          onClick={toggleMode}
          className="text-xs"
        >
          切换到{isExam ? '故事线模式' : '考试模式'}
        </Button>
      </div>

      {/* 章节渲染 */}
      {chapters.map((chapterUnits, chapterIdx) => (
        <div key={chapterIdx} className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-bold',
                isExam ? 'text-vermilion' : 'text-muted-foreground'
              )}
            >
              {chapterNames[chapterIdx] || `Level ${chapterIdx + 1}`}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {chapterUnits.map((unit) => {
              const p = progressMap.get(unit.id)
              const status = p?.status || 'locked'
              const score = p?.best_score || 0
              const isLocked = status === 'locked'
              const isMastered = status === 'mastered'
              const isCompleted = status === 'completed' || isMastered
              const isInProgress = status === 'available' || status === 'in_progress'

              // 卡片内容包装：未锁的卡片可点击进详情页
              const card = (
                <Card
                  className={cn(
                    'h-full transition-all',
                    !isLocked && 'cursor-pointer hover:border-vermilion/40 hover:shadow-md',
                    isLocked && 'opacity-50',
                    isCompleted && 'border-jade/40',
                    isInProgress && 'border-vermilion/40 ring-1 ring-vermilion/20'
                  )}
                >
                  <CardContent className="p-4">
                    {/* 状态行 */}
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          isExam ? 'text-vermilion' : 'text-muted-foreground'
                        )}
                      >
                        {isExam
                          ? `HSK ${unit.hsk_level} · U${unit.unit_number}`
                          : `Unit ${unit.unit_number}`}
                      </span>
                      {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {isInProgress && <Play className="h-3 w-3 text-vermilion" />}
                      {isCompleted && !isMastered && (
                        <CheckCircle2 className="h-3 w-3 text-jade" />
                      )}
                      {isMastered && <Star className="h-3 w-3 fill-gold text-gold" />}
                    </div>

                    {/* 标题 */}
                    <h3 className="mb-1 font-semibold">{unit.title}</h3>

                    {/* 描述 */}
                    {!isExam && (
                      <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                        {unit.description}
                      </p>
                    )}

                    {/* 考试模式：显示语法点 + 题型 */}
                    {isExam && (
                      <div className="mb-3 space-y-1">
                        {unit.grammar_points?.slice(0, 2).map((g, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground">
                            · {g}
                          </p>
                        ))}
                        {unit.exam_skills?.[0] && (
                          <p className="text-[11px] text-vermilion/80">
                            题型：{unit.exam_skills[0]}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 分数 */}
                    {!isLocked && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          最高分:{' '}
                          <span
                            className={cn(
                              'font-bold',
                              score >= 80
                                ? 'text-jade'
                                : score >= 65
                                ? 'text-gold'
                                : 'text-vermilion'
                            )}
                          >
                            {score}
                          </span>
                        </span>
                        {!isMastered && !isLocked && (
                          <span className="text-xs text-muted-foreground">
                            需 {unit.unlock_score}+
                          </span>
                        )}
                      </div>
                    )}

                    {/* 解锁提示 */}
                    {isLocked && (
                      <p className="text-xs text-muted-foreground">
                        完成上一单元 {unit.unlock_score}+ 分解锁
                      </p>
                    )}

                    {/* 进度条 */}
                    {!isLocked && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            isMastered
                              ? 'bg-gold'
                              : isCompleted
                              ? 'bg-jade'
                              : 'bg-vermilion'
                          )}
                          style={{ width: `${Math.min(100, score)}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )

              // 锁定卡片不可点
              if (isLocked) return <div key={unit.id}>{card}</div>

              return (
                <Link key={unit.id} href={`/unit/${unit.id}`} className="block h-full">
                  {card}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
