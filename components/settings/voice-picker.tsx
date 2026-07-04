'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Volume2, Check } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface VoiceOption {
  id: string
  name: string
  gender: 'female' | 'male'
  description: string
}

const VOICES: VoiceOption[] = [
  { id: 'BV700_streaming', name: '灿灿', gender: 'female', description: '亲切自然，适合日常对话' },
  { id: 'BV701_streaming', name: '擎苍', gender: 'male', description: '沉稳磁性，适合商务场景' },
  { id: 'BV704_streaming', name: '棉米', gender: 'female', description: '软萌甜，适合初学者' },
  { id: 'BV405_streaming', name: '奶绿', gender: 'female', description: '温柔知性，适合朗读' },
  { id: 'BV406_streaming', name: '超人', gender: 'male', description: '活力标准，适合练习' },
  { id: 'BV123_streaming', name: '阳光青年', gender: 'male', description: '阳光活力，适合日常' },
  { id: 'BV104_streaming', name: '儒雅青年', gender: 'male', description: '儒雅温和，适合正式' },
  { id: 'BV120_streaming', name: '活力女生', gender: 'female', description: '活泼热情，适合互动' }
]

const PREVIEW_TEXT = '你好！我是你的中文老师，让我们一起开始学习吧。'

export function VoicePicker({ currentVoice, profileId }: { currentVoice: string; profileId: string }) {
  const supabase = getSupabaseClient()
  const [selected, setSelected] = useState(currentVoice)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handlePreview(voiceId: string) {
    setPreviewing(voiceId)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: PREVIEW_TEXT, voice_type: voiceId })
      })
      if (!res.ok) throw new Error('Preview failed')
      const { audio } = await res.json()
      if (audio) {
        const audioEl = new Audio(`data:audio/mp3;base64,${audio}`)
        audioEl.onended = () => setPreviewing(null)
        audioEl.play()
      }
    } catch {
      toast.error('Failed to preview voice')
    } finally {
      setPreviewing(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tts_voice_type: selected })
        .eq('id', profileId)
      if (error) throw error
      setSaved(true)
      toast.success('Voice saved')
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Teacher Voice</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Choose the voice for your AI Chinese teacher. Click to preview.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {VOICES.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setSelected(voice.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                selected === voice.id
                  ? 'border-vermilion bg-vermilion/5'
                  : 'border-input hover:bg-accent'
              )}
            >
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                voice.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
              )}>
                {voice.gender === 'female' ? '♀' : '♂'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-medium">{voice.name}</span>
                  {selected === voice.id && <Check className="h-3 w-3 text-vermilion" />}
                </div>
                <p className="text-xs text-muted-foreground">{voice.description}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handlePreview(voice.id) }}
                disabled={previewing === voice.id}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-vermilion"
              >
                {previewing === voice.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            </button>
          ))}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || selected === currentVoice}
          className="mt-4"
          variant={saved ? 'outline' : 'primary'}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saved ? 'Saved!' : 'Save voice'}
        </Button>
      </CardContent>
    </Card>
  )
}
