import { RESTAURANT_LESSON } from '@/lib/lessons/restaurant'
import { type LessonDefinition } from '@/lib/lessons/core'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
interface Props {
  lesson?: LessonDefinition
  nextReviewAt: string | null
  due: boolean
  loading: boolean
  scheduleError: string
  onLearn: () => void
  onReview: () => void
  onRefresh: () => void
}
export function LessonIntro({ lesson = RESTAURANT_LESSON, nextReviewAt, due, loading, scheduleError, onLearn, onReview, onRefresh }: Props) {
  const ready = due && !!nextReviewAt && !loading && !scheduleError
  const schedule = <section aria-live="polite" className="space-y-3 rounded-lg border p-5"><h2 className="font-semibold">Your recall schedule</h2>
    {loading ? <p>Loading schedule…</p> : scheduleError ? <p role="alert">{scheduleError}</p> : nextReviewAt ? <>
      <p>{ready ? 'Your recall practice is due. Try without revisiting the model first.' : `Next recall: ${new Date(nextReviewAt).toLocaleString()}. Repeating the lesson will not postpone it.`}</p>
      {ready && <Button variant="primary" onClick={onReview}>Start {lesson.reviewTasks.length} recall tasks</Button>}
    </> : <p>Save this lesson to schedule your first recall in about 24 hours. This schedule stays with your account.</p>}
    <Button variant="ghost" size="sm" disabled={loading} onClick={onRefresh}>Refresh schedule</Button>
  </section>
  return <>
    {ready && schedule}
    <Card><CardContent className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Your goal</h2><p>{lesson.goal}</p>
      <p className="text-sm text-muted-foreground">Allow about 8–10 minutes, at your own pace. Basic Chinese typing helps; you can study the model if you cannot type yet. Optional audio is synthetic. This is a first practice, not proof of proficiency or an official exam task.</p>
      <ol className="list-inside list-decimal space-y-1"><li>Notice the example and useful chunks</li><li>Check meaning and build a phrase</li><li>{lesson.productionStep}</li><li>Return later for recall practice</li></ol>
      <Button variant={ready ? 'outline' : 'primary'} onClick={onLearn}>{nextReviewAt ? 'Practise the lesson again' : 'Start lesson'}</Button>
    </CardContent></Card>
    {!ready && schedule}
  </>
}

export const RestaurantIntro = LessonIntro
