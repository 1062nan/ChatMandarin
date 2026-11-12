import { isReviewableMistake } from '@/lib/ai/conversation-feedback'

/** Page past quarantined legacy cards without fetching an unbounded history. */
export async function collectReviewQueue<T extends { correct:string; explanation?:string|null }>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  limit = 50
): Promise<{ cards: T[]; hasMore: boolean }> {
  const cards: T[] = []
  for (let page = 0; page < 10; page++) {
    const { data, error } = await fetchPage(page * 100, page * 100 + 99)
    if (error) throw new Error('Unable to load reviews. Please retry.')
    const rows = data || []
    cards.push(...rows.filter(isReviewableMistake))
    if (cards.length >= limit) return { cards: cards.slice(0, limit), hasMore: cards.length > limit || rows.length === 100 }
    if (rows.length < 100) return { cards, hasMore: false }
  }
  return { cards, hasMore: true }
}
