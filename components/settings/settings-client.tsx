'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'
import type { CorrectionMode } from '@/lib/db/types'

interface SettingsClientProps {
  profile: {
    id: string
    hsk_level: number
    correction_mode: CorrectionMode
    audio_speed: number
  }
}

const correctionModes: { value: CorrectionMode; label: string; description: string }[] = [
  {
    value: 'friendly',
    label: 'Friend Mode',
    description: 'AI naturally uses correct form without pointing out errors. Best for beginners.'
  },
  {
    value: 'strict',
    label: 'Teacher Mode',
    description: 'AI directly points out errors and asks you to retry. Best for exam prep.'
  },
  {
    value: 'tutor',
    label: 'Tutor Mode',
    description: 'AI explains why something is wrong and gives examples. Best for deep learning.'
  }
]

export function SettingsClient({ profile }: SettingsClientProps) {
  const supabase = getSupabaseClient()
  const [hskLevel, setHskLevel] = useState(profile.hsk_level)
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>(profile.correction_mode)
  const [audioSpeed, setAudioSpeed] = useState(profile.audio_speed)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          hsk_level: hskLevel,
          correction_mode: correctionMode,
          audio_speed: audioSpeed
        })
        .eq('id', profile.id)

      if (error) throw error
      toast.success('Settings saved')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Customize your learning experience</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HSK Level</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label>Your current Chinese proficiency level</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <button
                key={level}
                onClick={() => setHskLevel(level)}
                className={cn(
                  'rounded-md border py-3 text-center font-semibold transition-colors',
                  hskLevel === level
                    ? 'border-vermilion bg-vermilion text-white'
                    : 'border-input hover:bg-accent'
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            AI will use vocabulary appropriate for HSK {hskLevel} learners.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Correction Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {correctionModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setCorrectionMode(mode.value)}
              className={cn(
                'w-full rounded-lg border p-4 text-left transition-colors',
                correctionMode === mode.value
                  ? 'border-vermilion bg-vermilion/5'
                  : 'border-input hover:bg-accent'
              )}
            >
              <div className="font-semibold">{mode.label}</div>
              <p className="mt-1 text-sm text-muted-foreground">{mode.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Voice Speed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={audioSpeed}
            onChange={(e) => setAudioSpeed(parseFloat(e.target.value))}
            className="w-full accent-vermilion"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Slow</span>
            <span className="font-medium text-foreground">{audioSpeed.toFixed(1)}x</span>
            <span>Fast</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} size="lg" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save settings
      </Button>
    </div>
  )
}
