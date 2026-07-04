import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date))
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function calculateAccuracy(scores: { pronunciation?: number | null; grammar?: number | null; fluency?: number | null; word_choice?: number | null }): number {
  const valid = Object.values(scores).filter((s): s is number => s !== null && s !== undefined)
  if (valid.length === 0) return 0
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}
