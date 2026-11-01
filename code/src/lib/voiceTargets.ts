/**
 * Whatever is on screen can be said. Duck needs no list of commands: it matches the sentence
 * against the labels of the controls in front of you, so "dress code" presses the Dress code tile.
 */
const FILLER = new Set(['a', 'an', 'and', 'at', 'can', 'do', 'go', 'i', 'in', 'is', 'it', 'lets', 'me', 'my', 'of', 'on', 'please', 'show', 'take', 'the', 'to', 'us', 'we', 'whats', 'with', 'you'])
// Most of a label must have been said, so one shared word doesn't press the wrong thing
const ENOUGH = 0.6

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !FILLER.has(w))

/** The label that best matches what was said, by index. Null when nothing is close enough. */
export function matchLabel(heard: string, labels: string[]): number | null {
  const said = new Set(words(heard))
  let best: number | null = null
  let bestScore = 0
  let bestLength = 0
  labels.forEach((label, i) => {
    const wanted = words(label)
    if (!wanted.length) return
    const score = wanted.filter((w) => said.has(w)).length / wanted.length
    if (score < ENOUGH) return
    // A longer label fully said is a more specific match than a shorter one
    if (score > bestScore || (score === bestScore && wanted.length > bestLength)) {
      best = i
      bestScore = score
      bestLength = wanted.length
    }
  })
  return best
}

/** "That one": a sentence that only means something next to whatever you're pointing at */
export const pointsAtSomething = (heard: string) => /\b(that|this|these|those|here|there)\b/i.test(heard) && words(heard.replace(/\b(that|this|these|those|here|there|one)\b/gi, '')).length === 0

export const asksToGoBack = (heard: string) => /\b(back|leave|step out|go out)\b/i.test(heard)
