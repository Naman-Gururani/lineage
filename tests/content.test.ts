// content.ts is the single source of truth for every fact about Naman: the
// panels, the reader, the journal and the dialogue all read from here. These
// assertions pin the facts that are easy to drift (the CGPA, the degree years)
// and the order the reader renders sections in.
import { describe, expect, it } from 'vitest'
import { PROFILE, ZONES, type Zone } from '../src/data/content'
import { NPC_TREES } from '../src/data/npcs'

const zone = (id: string): Zone => {
  const z = ZONES.find((x) => x.id === id)
  expect(z, `missing zone "${id}"`).toBeDefined()
  return z!
}

const factOf = (z: Zone, k: string): string | undefined => z.content.facts?.find((f) => f.k === k)?.v

/** Everything a zone card can put in front of a reader, as one string. */
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
    ...(z.content.links ?? []).map((l) => `${l.label} ${l.value}`),
  ].join('\n')

/** Everything a zone card can put in front of a reader. */
const allCardText = ZONES.map(textOf).join('\n')

/** …and everything a villager or an object can say about it. */
const allDialogueText = Object.values(NPC_TREES)
  .flatMap((t) => Object.values(t.nodes).flatMap((n) => n.lines.map((l) => l.text)))
  .join('\n')

/** The island's whole voice: cards and conversation together. */
const allText = `${allCardText}\n${allDialogueText}`

describe('profile', () => {
  it('names the person, the role and where they are', () => {
    expect(PROFILE.name).toBe('Naman Gururani')
    expect(PROFILE.role).toBe('Software Development Engineer')
    expect(PROFILE.company).toBe('Barclays')
    expect(PROFILE.location).toBe('India')
    expect(PROFILE.email).toBe('gururaninaman@gmail.com')
  })
})

describe('the CGPA is 9.63', () => {
  it('reads 9.63 / 10 in the About facts', () => {
    expect(factOf(zone('about'), 'CGPA')).toBe('9.63 / 10')
  })

  it('reads 9.63 / 10 in the Education facts', () => {
    expect(factOf(zone('education'), 'CGPA')).toBe('9.63 / 10')
  })

  it('never says 9.57 anywhere on the island — zone cards or villager dialogue', () => {
    expect(allText).not.toContain('9.57')
    // the scan really does cover both halves, so it cannot quietly shrink back
    // to the cards and let a stale figure live on in a dialogue tree
    expect(allDialogueText).toContain('9.63')
    expect(allCardText).toContain('9.63')
  })
})

describe('the education zone', () => {
  const edu = zone('education')

  it('stands on Campus Green as a campus landmark', () => {
    expect(edu.name).toBe('SRM Campus')
    expect(edu.label).toBe('Education')
    expect(edu.kind).toBe('campus')
    expect([edu.tx, edu.ty]).toEqual([57, 26])
    expect(edu.accent).toBe(0x7ec8ff)
  })

  it('states the degree, the institute and the years', () => {
    expect(edu.content.kicker).toBe('STUDY')
    expect(edu.content.title).toBe('SRM Institute of Science and Technology')
    expect(edu.content.sub).toBe('B.Tech, Computer Science & Engineering · 2020 – 2024')
    expect(edu.content.facts).toEqual([
      { k: 'Degree', v: 'B.Tech CSE' },
      { k: 'Years', v: '2020 – 2024' },
      { k: 'CGPA', v: '9.63 / 10' },
    ])
    expect(edu.content.body).toEqual(['Where systems stopped being homework and started being fun.'])
  })

  it('agrees with the education line the About card already carried', () => {
    expect(factOf(zone('about'), 'Education')).toContain('SRM IST')
    expect(factOf(zone('about'), 'Education')).toContain('2020')
    expect(factOf(zone('about'), 'Education')).toContain('2024')
  })

  it('is the only campus on the island', () => {
    expect(ZONES.filter((z) => z.kind === 'campus').map((z) => z.id)).toEqual(['education'])
  })
})

describe('reader order', () => {
  it('runs About → Experience → Education → Skills → Projects → Contact', () => {
    expect(ZONES.map((z) => z.label)).toEqual(['About', 'Experience', 'Education', 'Skills', 'Project', 'Project', 'Project', 'Contact'])
  })

  it('puts education between experience and skills', () => {
    const at = (id: string) => ZONES.findIndex((z) => z.id === id)
    expect(at('experience')).toBeLessThan(at('education'))
    expect(at('education')).toBeLessThan(at('skills'))
  })
})

describe('every zone', () => {
  it('has a unique id, a name, a label, a title and an accent', () => {
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length)
    for (const z of ZONES) {
      expect(z.name.trim().length, `${z.id} name`).toBeGreaterThan(0)
      expect(z.label.trim().length, `${z.id} label`).toBeGreaterThan(0)
      expect(z.content.title.trim().length, `${z.id} title`).toBeGreaterThan(0)
      expect(z.accent, `${z.id} accent`).toBeGreaterThan(0)
      expect(z.accent, `${z.id} accent`).toBeLessThanOrEqual(0xffffff)
    }
  })

  it('leaves the in-development product unnamed', () => {
    const vault = zone('stealth')
    expect(vault.content.title).toBe('A consumer product, in development')
    expect(vault.content.sub).toBe('Independent')
  })
})
