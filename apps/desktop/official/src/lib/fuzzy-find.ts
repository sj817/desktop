import { compareDescending } from './compare'

export interface IMatches {
  readonly title: ReadonlyArray<number>
  readonly subtitle: ReadonlyArray<number>
}

export interface IMatch<T> {
  /** `0 <= score <= 1` */
  score: number
  item: T
  matches: IMatches
}

export type KeyFunction<T> = (item: T) => ReadonlyArray<string>

function isWordBoundary(text: string, index: number): boolean {
  if (index === 0) {
    return true
  }
  const prev = text[index - 1]
  return (
    prev === '/' ||
    prev === '-' ||
    prev === '_' ||
    prev === '.' ||
    prev === ' ' ||
    prev === '\\'
  )
}

function substringScore(text: string, lowerText: string, query: string): number {
  const idx = lowerText.indexOf(query)
  if (idx === -1) {
    return 0
  }
  if (lowerText === query) {
    return 1.0
  }
  if (idx === 0) {
    return 0.9
  }
  if (isWordBoundary(text, idx)) {
    return 0.7
  }
  return 0.5
}

function findMatchIndices(
  lowerText: string,
  query: string
): ReadonlyArray<number> {
  const idx = lowerText.indexOf(query)
  if (idx === -1) {
    return []
  }
  return Array.from({ length: query.length }, (_, i) => idx + i)
}

export function match<T>(
  query: string,
  items: ReadonlyArray<T>,
  getKey: KeyFunction<T>
): ReadonlyArray<IMatch<T>> {
  const lowerQuery = query.toLowerCase()

  const result: Array<IMatch<T>> = []

  for (const item of items) {
    const texts = getKey(item)
    let bestScore = 0
    const allMatches: Array<ReadonlyArray<number>> = []

    for (const text of texts) {
      const lowerText = text.toLowerCase()
      const score = substringScore(text, lowerText, lowerQuery)
      allMatches.push(score > 0 ? findMatchIndices(lowerText, lowerQuery) : [])
      bestScore = Math.max(bestScore, score)
    }

    if (bestScore > 0) {
      result.push({
        score: bestScore,
        item,
        matches: {
          title: allMatches[0] ?? [],
          subtitle: allMatches.length > 1 ? allMatches[1] : [],
        },
      })
    }
  }

  return result.sort(({ score: a }, { score: b }) => compareDescending(a, b))
}
