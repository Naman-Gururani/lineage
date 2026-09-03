// The page shell states résumé facts of its own: the `<meta description>` a
// search engine quotes, and the `<noscript>` block that is the whole portfolio
// for anyone the game will not load for. Neither is generated from anything —
// they are hand-written HTML, so nothing stopped them drifting away from the
// résumé while `content.ts` moved on.
//
// The rule for the rest of the repo is that a fact about Naman comes from
// `src/data/content.ts` and nowhere else. This suite is how that rule reaches
// `index.html`: every claim the page makes has to be findable, word for word,
// in the corpus the cards and the reader are built out of.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROFILE, ZONES, type Zone } from '../src/data/content'

/** The handful of entities the page actually uses, so `&amp;` compares as `&`. */
const decode = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')

const HTML = decode(readFileSync(resolve(__dirname, '../index.html'), 'utf8'))

/**
 * Everything a zone card can put in front of a reader, as one string — the same
 * flatten `tests/content.test.ts` uses, plus the links' hrefs: a card that shows
 * a link publishes the address behind it too, and the `<noscript>` block quotes
 * those addresses rather than the handles.
 */
const textOf = (z: Zone): string =>
  [
    z.name,
    z.label,
    z.content.kicker ?? '',
    z.content.title,
    z.content.sub ?? '',
    ...(z.content.body ?? []),
    ...(z.content.points ?? []),
    ...(z.content.chips ?? []),
    ...(z.content.facts ?? []).map((f) => `${f.k} ${f.v}`),
    ...(z.content.groups ?? []).flatMap((g) => [g.label, ...g.items]),
    ...(z.content.links ?? []).map((l) => `${l.label} ${l.value} ${l.href ?? ''}`),
  ].join('\n')

/**
 * The cards, plus `PROFILE` — the same file, and the only place the full name
 * and the contact addresses are written down.
 */
const CORPUS = [...ZONES.map(textOf), ...Object.values(PROFILE)].join('\n')

/**
 * Every résumé fact the page shell states, exactly as it is written there.
 *
 * A phrase goes in this list as the *shortest* form that is still a claim about
 * Naman: the page says "backend & streaming-data engineering" and the About card
 * says "backend & streaming-data engineer", so the shared stem is what is
 * pinned. Punctuation between two facts is the page's own business — "Software
 * Development Engineer at Barclays" is two entries, not one, because the card
 * joins them with a middot instead of "at".
 */
const FACTS = [
  // who
  PROFILE.name,
  'Software Development Engineer',
  'Barclays',
  'backend & streaming-data engineer',
  // the stack the noscript block lists
  'Apache Kafka',
  'Apache Flink',
  'Kafka Streams',
  'IBM MQ',
  'Redis',
  'DynamoDB',
  // where to reach him
  PROFILE.email,
  'github.com/Naman-Gururani',
  'linkedin.com/in/naman-gururani',
]

describe('index.html', () => {
  it('states no fact about Naman that content.ts does not state', () => {
    for (const fact of FACTS) {
      // Both directions matter. The first keeps this list honest — a fact
      // dropped from the page must be dropped from here, deliberately, rather
      // than leaving a pin that guards nothing. The second is the actual rule.
      expect(HTML, `index.html no longer says "${fact}" — update FACTS or put it back`).toContain(fact)
      expect(CORPUS, `index.html says "${fact}"; src/data/content.ts does not`).toContain(fact)
    }
  })

  it('publishes no contact detail that content.ts has not published', () => {
    // Caught by shape rather than by list, so a *new* address added to the page
    // is caught as well as a stale one.
    const found = [...HTML.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g), ...HTML.matchAll(/(?:github|linkedin)\.com\/[\w./-]+/g)].map((m) => m[0])
    expect(new Set(found).size, 'the email and both profile links should still be on the page').toBe(3)
    for (const hit of new Set(found)) expect(CORPUS, `index.html publishes "${hit}"; src/data/content.ts does not`).toContain(hit)
  })

  it('keeps the résumé prose to the description and the noscript block', () => {
    // The two places that are allowed to talk about the job. A fact anywhere
    // else has escaped into markup nobody thinks to update.
    const rest = HTML.replace(/<meta\s+name="description"[\s\S]*?\/>/, '').replace(/<noscript>[\s\S]*?<\/noscript>/, '')
    for (const fact of ['backend & streaming-data engineer', 'Apache Kafka', 'IBM MQ', 'DynamoDB', PROFILE.email]) {
      expect(rest, `"${fact}" is stated outside the description and the noscript block`).not.toContain(fact)
    }
  })
})
