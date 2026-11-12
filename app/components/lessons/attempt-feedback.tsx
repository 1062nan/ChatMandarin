import { gradeLessonTasks, tasksForLesson, type LessonDefinition, type LessonMode, type TaskAnswer } from '@/lib/lessons/core'

/** Current-attempt feedback only. Never stored, logged, or sent by this component. */
export function AttemptFeedback({ lesson, mode, answers }: { lesson: LessonDefinition; mode: LessonMode; answers: TaskAnswer[] }) {
  const tasks = tasksForLesson(lesson, mode)
  const summary = gradeLessonTasks(lesson, mode, answers)
  const revisit = summary.outcomes.filter(outcome => !outcome.unaided)
  return <section aria-label="What to revisit" className="space-y-3">
    <h3 className="font-semibold">What to revisit</h3>
    {revisit.length ? <>
      <p className="text-sm text-muted-foreground">Compare your final answers below. These details are only available in this attempt, not in your saved progress. Reading a model now does not change your result or recall schedule.</p>
      <ul className="space-y-3">{revisit.map(outcome => {
        const task = tasks.find(task => task.id === outcome.id)!
        const answer = answers.find(answer => answer.id === outcome.id)!
        const answerText = task.options ? task.options.find((_, index) => String(index) === answer.value) || 'No recognized option' : answer.value
        return <li key={task.id} className="space-y-2 rounded-lg border p-4">
          <p className="font-medium">{task.prompt}</p>
          <p className="text-sm">{outcome.matched ? 'Matched with support or after another check.' : task.options ? 'This choice does not match the task. Compare it with the model and explanation.' : 'Not matched by this limited checker; another phrasing may still be valid.'}{answer.hintUsed && ' A hint was shown.'}{!answer.firstTry && ' Not recorded as a first-try match.'}</p>
          <p className="text-xs text-muted-foreground">Your final answer (not saved)</p>
          <p lang={task.options ? undefined : 'zh'} className="whitespace-pre-wrap break-words">{answerText}</p>
          <details className="rounded-lg bg-muted/50 p-3">
            <summary className="cursor-pointer font-medium">Compare with one model and explanation</summary>
            <p lang="zh" className="mt-2 whitespace-pre-wrap">{task.example}</p>
            <p className="mt-2 text-sm">{task.explanation}</p>
          </details>
        </li>
      })}</ul>
      <p className="text-sm">After comparing, try saying the idea again without looking. This extra practice is not graded or saved. Return for the scheduled recall later.</p>
    </> : <p>Try the later recall without looking at the model. One good attempt is a starting point, not permanent mastery.</p>}
  </section>
}
