'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { Lock, CheckCircle2, Play, Star, ChevronRight } from 'lucide-react'
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

  const chapterNames = mode === 'journey'
    ? ['第一章：初识中国', '第二章：融入生活', '第三章：职场进阶', '第四章：文化精通', '第五章：巅峰中文']
    : ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5']

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
        <h2 className="text-lg font-semibold">
          {mode === 'journey' ? '🗺️ 中文之旅' : '📋 HSK 备考'}
        </h2>
        <Button
          variant="outline"
          size="sm"
          disabled={switching}
          onClick={toggleMode}
          className="text-xs"
        >
          切换到{mode === 'journey' ? '考试模式' : '故事线模式'}
        </Button>
      </div>

      {/* 章节渲染 */}
      {chapters.map((chapterUnits, chapterIdx) => (
        <div key={chapterIdx} className="space-y-3">
          {/* 章节标题 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-muted-foreground">
              {chapterNames[chapterIdx] || `Level ${chapterIdx + 1}`}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* 单元卡片 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {chapterUnits.map((unit) => {
              const p = progressMap.get(unit.id)
              const status = p?.status || 'locked'
              const score = p?.best_score || 0
              const isLocked = status === 'locked'
              const isMastered = status === 'mastered'
              const isCompleted = status === 'completed' || isMastered
              const isInProgress = status === 'available' || status === 'in_progress'

              return (
                <Card
                  key={unit.id}
                  className={cn(
                    'cursor-pointer transition-all',
                    isLocked && 'opacity-50 cursor-not-allowed',
                    isCompleted && 'border-jade/40',
                    isInProgress && 'border-vermilion/40 ring-1 ring-vermilion/20'
                  )}
                >
                  <CardContent className="p-4">
                    {/* 状态图标 */}
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Unit {unit.unit_number}
                      </span>
                      {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {isInProgress && <Play className="h-3 w-3 text-vermilion" />}
                      {isCompleted && !isMastered && <CheckCircle2 className="h-3 w-3 text-jade" />}
                      {isMastered && <Star className="h-3 w-3 fill-gold text-gold" />}
                    </div>

                    {/* 标题 */}
                    <h3 className="mb-1 font-semibold">{unit.title}</h3>

                    {/* 描述 */}
                    <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                      {unit.description}
                    </p>

                    {/* 分数 */}
                    {!isLocked && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          最高分: <span className={cn(
                            'font-bold',
                            score >= 80 ? 'text-jade' : score >= 65 ? 'text-gold' : 'text-vermilion'
                          )}>{score}</span>
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
                            isMastered ? 'bg-gold' : isCompleted ? 'bg-jade' : 'bg-vermilion'
                          )}
                          style={{ width: `${Math.min(100, score)}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
