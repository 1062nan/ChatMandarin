import { createLessonHandlers } from '@/lib/lessons/server'
import { RESTAURANT_LESSON } from '@/lib/lessons/restaurant'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const { GET, POST } = createLessonHandlers(RESTAURANT_LESSON)
