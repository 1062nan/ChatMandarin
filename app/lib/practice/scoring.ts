const STRIPPED_PUNCTUATION = /[\s\p{P}\p{S}]/gu

export interface CharacterComparison {
  char: string
  userSaid: string
  correct: boolean
}

export interface TranscriptError {
  type: 'transcript'
  user_said: string
  correct: string
  explanation: string
}

export function normalizePracticeText(value: string): string {
  return value.replace(STRIPPED_PUNCTUATION, '')
}

export function comparePracticeTexts(userText: string, original: string): {
  accuracyScore: number
  charByChar: CharacterComparison[]
  errors: TranscriptError[]
} {
  const userChars = [...normalizePracticeText(userText)]
  const originalChars = [...normalizePracticeText(original)]
  const distances = Array.from(
    { length: originalChars.length + 1 },
    () => Array<number>(userChars.length + 1).fill(0)
  )
  for (let i = 0; i <= originalChars.length; i += 1) distances[i][0] = i
  for (let j = 0; j <= userChars.length; j += 1) distances[0][j] = j

  for (let i = 1; i <= originalChars.length; i += 1) {
    for (let j = 1; j <= userChars.length; j += 1) {
      const substitutionCost = originalChars[i - 1] === userChars[j - 1] ? 0 : 1
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + substitutionCost
      )
    }
  }

  const reversed: CharacterComparison[] = []
  let i = originalChars.length
  let j = userChars.length
  while (i > 0 || j > 0) {
    if (
      i > 0 && j > 0
      && distances[i][j] === distances[i - 1][j - 1]
        + (originalChars[i - 1] === userChars[j - 1] ? 0 : 1)
    ) {
      reversed.push({
        char: originalChars[i - 1],
        userSaid: userChars[j - 1],
        correct: originalChars[i - 1] === userChars[j - 1],
      })
      i -= 1
      j -= 1
    } else if (i > 0 && distances[i][j] === distances[i - 1][j] + 1) {
      reversed.push({ char: originalChars[i - 1], userSaid: '_', correct: false })
      i -= 1
    } else {
      // An inserted user character still lowers the edit-distance score, but it
      // has no canonical character to render in the per-character target view.
      j -= 1
    }
  }
  const charByChar = reversed.reverse()

  const errors = charByChar
    .filter((entry) => !entry.correct && entry.userSaid !== '_')
    .map((entry) => ({
      type: 'transcript' as const,
      user_said: entry.userSaid,
      correct: entry.char,
      explanation: `Transcript contains "${entry.userSaid}" instead of "${entry.char}"`,
    }))

  return {
    accuracyScore: originalChars.length === 0 ? 0 : Math.round(
      (1 - distances[originalChars.length][userChars.length]
        / Math.max(originalChars.length, userChars.length, 1)) * 100
    ),
    charByChar,
    errors,
  }
}

export function calculateCompletionScore(userText: string, original: string): number {
  const userLength = normalizePracticeText(userText).length
  const originalLength = normalizePracticeText(original).length
  if (originalLength === 0) return 0
  return Math.min(100, Math.round((userLength / originalLength) * 100))
}

export function clampScore(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback
}
