'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import {
  Play,
  CheckCircle2,
  Lock,
  Star,
  Mic,
  Volume2,
  Video,
  BookOpen,
  Target,
} from 'lucide-react'

interface UnitClientProps {
  unit: {
    id: string
    hsk_level: number
    unit_number: number
    title: string
    description: string
    difficulty: string
    unlock_score: number
    grammar_points?: string[]
    vocab_topics?: string[]
    exam_skills?: string[]
  }
  scenarios: Array<{
    id: string
    name: any
    description: any
    recommended_hsk: number[]
    duration_minutes: number
  }>
  shadowing: Array<{
    id: string
    text_zh: string
    text_pinyin: string
    text_en: string
    hsk_level: number
    category: string
    difficulty: string
  }>
  dubbing: Array<{
    id: string
    title: string
    category: string
    description: string
    duration_seconds: number
    hsk_level: number
    difficulty: string
  }>
  progress: { status: string; best_score: number } | null
  displayMode: 'journey' | 'exam'
}

export function UnitClient({
  unit,
  scenarios,
  shadowing,
  dubbing,
  progress,
  displayMode,
}: UnitClientProps) {
  const status = progress?.status || 'locked'
  const isLocked = status === 'locked'
  const score = progress?.best_score || 0
  const isExam = displayMode === 'exam'

  return (
    <div className="space-y-6">
      {/* 单元标题 */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          {isExam ? (
            <>
              <span className="font-bold">HSK {unit.hsk_level}</span>
              <span>·</span>
              <span>Unit {unit.unit_number}</span>
              <span>·</span>
              <span className="capitalize">{unit.difficulty}</span>
            </>
          ) : (
            <>
              <span>第 {unit.hsk_level} 章 · 第 {unit.unit_number} 节</span>
              <span>·</span>
              <span className="capitalize">{unit.difficulty}</span>
            </>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{unit.title}</h1>
        <p className="mt-1 text-muted-foreground">{unit.description}</p>

        {/* 状态条 */}
        <div className="mt-3 flex items-center gap-3">
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> 未解锁
            </span>
          )}
          {status === 'in_progress' && (
            <span className="inline-flex items-center gap-1 text-xs text-vermilion">
              <Play className="h-3 w-3" /> 进行中 · 最高分 {score}
            </span>
          )}
          {status === 'completed' && (
            <span className="inline-flex items-center gap-1 text-xs text-jade">
              <CheckCircle2 className="h-3 w-3" /> 已完成 · 最高分 {score}
            </span>
          )}
          {status === 'mastered' && (
            <span className="inline-flex items-center gap-1 text-xs text-gold">
              <Star className="h-3 w-3 fill-gold" /> 已掌握 · 满分通关
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            · 解锁下一关需 {unit.unlock_score}+ 分
          </span>
        </div>
      </div>

      {/* HSK 大纲信息（考试模式默认展示，故事模式折叠） */}
      {(isExam || !isLocked) && (unit.grammar_points?.length || unit.exam_skills?.length) && (
        <Card className={cn(isExam ? 'border-vermilion/30 bg-vermilion/5' : 'bg-muted/30')}>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-vermilion" />
              <span className="text-sm font-semibold">本单元 HSK {unit.hsk_level} 训练目标</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {unit.grammar_points && unit.grammar_points.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    <BookOpen className="mr-1 inline h-3 w-3" />
                    重点语法
                  </p>
                  <ul className="space-y-0.5">
                    {unit.grammar_points.map((g, i) => (
                      <li key={i} className="text-sm">• {g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {unit.exam_skills && unit.exam_skills.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    <Target className="mr-1 inline h-3 w-3" />
                    考试题型
                  </p>
                  <ul className="space-y-0.5">
                    {unit.exam_skills.map((s, i) => (
                      <li key={i} className="text-sm">• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 内容区 */}
      {isLocked ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">该单元尚未解锁</p>
            <p className="text-sm text-muted-foreground">
              完成上一单元并达到 {unit.unlock_score}+ 分即可解锁
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 场景对话 */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Mic className="h-5 w-5 text-vermilion" />
              场景对话
              <span className="text-sm text-muted-foreground">({scenarios.length})</span>
            </h2>
            {scenarios.length === 0 ? (
              <EmptyHint text="该单元暂无场景内容，可先练习跟读或配音。" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {scenarios.map((s) => (
                  <Link key={s.id} href={`/conversation/${s.id}`}>
                    <Card className="cursor-pointer transition-all hover:border-vermilion/40 hover:shadow-md">
                      <CardContent className="p-4">
                        <p className="font-medium">
                          {typeof s.name === 'object' ? s.name.zh || s.name.en : s.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {typeof s.description === 'object'
                            ? s.description.en
                            : s.description}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          约 {s.duration_minutes || 5} 分钟
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 影子跟读 */}
          {shadowing.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Volume2 className="h-5 w-5 text-jade" />
                影子跟读
                <span className="text-sm text-muted-foreground">({shadowing.length})</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {shadowing.slice(0, 8).map((s) => (
                  <Link key={s.id} href="/shadowing">
                    <Card className="cursor-pointer transition-all hover:border-jade/40">
                      <CardContent className="p-3">
                        <p className="text-sm font-medium">{s.text_zh}</p>
                        <p className="text-xs text-muted-foreground">{s.text_pinyin}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 影视配音 */}
          {dubbing.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Video className="h-5 w-5 text-gold" />
                影视配音
                <span className="text-sm text-muted-foreground">({dubbing.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {dubbing.map((d) => (
                  <Link key={d.id} href={`/dubbing/${d.id}`}>
                    <Card className="cursor-pointer transition-all hover:border-gold/40">
                      <CardContent className="p-3">
                        <p className="font-medium">{d.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {d.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          约 {Math.round((d.duration_seconds || 40) / 60)} 分钟 · {d.difficulty}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 空单元兜底 */}
          {scenarios.length === 0 && shadowing.length === 0 && dubbing.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                该单元内容还在准备中。可以前往{' '}
                <Link href="/shadowing" className="text-vermilion underline">跟读练习</Link>{' '}
                或{' '}
                <Link href="/dubbing" className="text-vermilion underline">配音练习</Link>{' '}
                通用内容先练起来。
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}
