import { createLessonHandlers } from '@/lib/lessons/server'
import { MEETING_TIME_LESSON } from '@/lib/lessons/meeting-time'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const { GET, POST } = createLessonHandlers(MEETING_TIME_LESSON)
