// Word Forge — the Wordscapes wheel on Ravi's bench, inside the mini-game modal.
//
// Everything that *decides* anything lives in `games/forge.ts`: which words a
// round takes, what a submission was worth, how much a hint gives away. This
// file is the bench itself — the slots on the wall, the letters laid round a
// circle, the trail a finger drags between them — plus the three ways a player
// can reach the same word: drag across the tiles, tap them one at a time, or
// simply type.
//
// Two things shape the code. The wheel's tiles are placed by *maths, not
// layout*: each one carries its angle as `--a` and rides out to the ring on a
// rotate/translate/un-rotate, so the same numbers that put a tile on screen also
// put a point on the SVG trail — no `getBoundingClientRect`, nothing to go stale
// when the panel resizes. And the reducer's ring order is not the wheel's: the
// tiles can be re-laid by Shuffle at any time, so `order` maps a seat on the
// wheel to a ring index and every event speaks to the reducer in ring indices.
import { sfx } from '../../audio/sfx'
import { events } from '../../core/events'
import {
  FORGE_MISSES,
  FORGE_ROUNDS,
  current,
  groupOf,
  hint,
  hintsLeft,
  newForge,
  pick,
  revealWord,
  roundOf,
  shuffle,
  submit,
  unpick,
  type ForgeRound,
  type ForgeState,
} from '../../games/forge'
import { afterWin, type MinigameHost, type MinigameSession } from '../../systems/Minigame'
import { esc } from '../modal'
import { panelHead } from '../panels'
import { reducedMotion } from '../state'

/* ---------------- the wheel's geometry ---------------- */

/** The circle the tiles ride out to — the `translate()` in the CSS, in px. */
const RADIUS = 110
/** The wheel's box, and the SVG's viewBox: wide enough for a tile at the rim. */
const WHEEL = 300

/** Where seat `p` of `n` sits, in degrees clockwise. Seat zero is at the top. */
function angleAt(p: number, n: number): number {
  return -90 + (p * 360) / n
}

/** The same seat as a point in the wheel's own coordinates, for the drag trail. */
function pointAt(p: number, n: number): { x: number; y: number } {
  const rad = (angleAt(p, n) * Math.PI) / 180
  return { x: WHEEL / 2 + RADIUS * Math.cos(rad), y: WHEEL / 2 + RADIUS * Math.sin(rad) }
}

/* ---------------- copy ---------------- */

const MISS_NOTE = "Not one of Naman's tools."
const DUP_NOTE = 'Already forged.'
const SHORT_NOTE = 'Not enough letters.'
const GAG_TITLE = 'Stuck at the bench?'
const GAG_SUB = 'Every word is a tool on the walls.'

/* ---------------- timings ---------------- */

const SHAKE_MS = 420
const FLASH_MS = 420
const NOTE_MS = 1600
/** A beat to watch the last word land before Ravi hangs the next wall. */
const ROUND_MS = 700
/** How long after a drag a click still counts as that drag's own echo. */
const DRAG_CLICK_MS = 200

export function mountForge(host: MinigameHost, root: HTMLElement): MinigameSession {
  let state: ForgeState = newForge()
  /** Seat → ring index. Shuffle permutes it; the reducer never sees a seat. */
  let order: number[] = []
  /** Ring index → seat, the inverse of `order`, rebuilt with the wheel. */
  let seat: number[] = []
  /** How many wheels have been re-laid, so each Shuffle is a different one. */
  let shuffles = 0
  /** Misses the overlay has already answered, so one bad word cannot re-open it. */
  let spentMisses = 0
  const timers: number[] = []

  root.innerHTML =
    panelHead('Word Forge', 'THE WORKSHOP') +
    `<p class="mg-rule">Spell the tools Naman actually uses. Drag or tap the letters, then press Enter.</p>` +
    // `role="list"` because `list-style: none` takes the list semantics away
    // with the bullets in Safari, and the wall is exactly a list of words.
    `<ul class="fg-slots" role="list" aria-label="Words to forge"></ul>` +
    `<div class="fg-bench"><p class="fg-current" aria-hidden="true"></p><p class="fg-note" aria-hidden="true" hidden></p></div>` +
    `<div class="fg-ring" role="group" aria-label="Letter wheel"></div>` +
    `<footer class="mg-foot">` +
    `<span class="mg-keys">Type or drag · <kbd>Enter</kbd> forge · <kbd>⌫</kbd> back</span>` +
    `<button type="button" class="pbtn" data-act="shuffle">Shuffle</button>` +
    `<button type="button" class="pbtn fg-hintbtn" data-act="hint"></button>` +
    `<button type="button" class="pbtn primary" data-act="enter">Enter</button>` +
    `<button type="button" class="pbtn" data-act="back" aria-label="Backspace">⌫</button>` +
    `<button type="button" class="pbtn" data-act="quit">Leave</button>` +
    `</footer>` +
    `<p class="mg-live sr-only" role="status"></p>`

  const slotList = root.querySelector<HTMLElement>('.fg-slots')!
  const bench = root.querySelector<HTMLElement>('.fg-current')!
  const noteEl = root.querySelector<HTMLElement>('.fg-note')!
  const wheel = root.querySelector<HTMLElement>('.fg-ring')!
  const hintBtn = root.querySelector<HTMLButtonElement>('.fg-hintbtn')!
  const live = root.querySelector<HTMLElement>('.mg-live')!
  let trail: SVGPolylineElement | null = null

  const say = (msg: string): void => {
    live.textContent = msg
  }

  const after = (ms: number, fn: () => void): void => {
    if (ms <= 0) {
      fn()
      return
    }
    timers.push(window.setTimeout(fn, ms))
  }

  function clearTimers(): void {
    for (const t of timers) clearTimeout(t)
    timers.length = 0
  }

  /* ---------------- drawing ---------------- */

  /**
   * The wall: one slot per word, clued by the group its skill is filed under and
   * nothing else. A blank tile per letter — never a count in words, which would
   * hand over the answer's shape twice.
   */
  function paintSlots(round: ForgeRound = roundOf(state)): void {
    slotList.innerHTML = round.words
      .map((w) => {
        const found = state.found.includes(w.word)
        const shown = found ? w.word.length : (state.revealed[w.word] ?? 0)
        const tiles = [...w.word]
          .map((ch, i) => `<span class="fg-tile${i < shown ? ' on' : ''}">${i < shown ? esc(ch) : ''}</span>`)
          .join('')
        return (
          `<li class="fg-slot${found ? ' found' : ''}" data-word="${esc(w.word)}">` +
          `<span class="fg-clue">${esc(groupOf(w.skill))}</span>` +
          `<span class="fg-word" aria-hidden="true">${tiles}</span>` +
          `<span class="sr-only">${found ? `${esc(w.word)}, ${esc(w.skill)} — forged` : 'not forged yet'}</span>` +
          `</li>`
        )
      })
      .join('')
  }

  /** Lay the tiles out: seat zero at the top, the rest evenly round the circle. */
  function paintWheel(): void {
    const ring = roundOf(state).ring
    const n = order.length
    seat = []
    order.forEach((ri, p) => (seat[ri] = p))
    wheel.innerHTML =
      `<svg class="fg-path" viewBox="0 0 ${WHEEL} ${WHEEL}" aria-hidden="true" focusable="false"><polyline points="" /></svg>` +
      order
        .map((ri, p) => `<button type="button" class="fg-letter" style="--a:${angleAt(p, n)}deg" data-i="${ri}">${esc(ring[ri])}</button>`)
        .join('')
    trail = wheel.querySelector<SVGPolylineElement>('polyline')
  }

  /**
   * The word on the bench, the tiles it is using, and the line between them.
   * `ghost` keeps a rejected word up while it shakes — the reducer has already
   * cleared the picks by then, and a shake with nothing in it says nothing.
   */
  function paintPicks(ghost?: string): void {
    const n = order.length
    for (const b of Array.from(wheel.querySelectorAll<HTMLElement>('.fg-letter'))) {
      b.classList.toggle('picked', state.picked.includes(Number(b.dataset.i)))
    }
    bench.textContent = ghost ?? current(state)
    trail?.setAttribute(
      'points',
      state.picked
        .map((ri) => {
          const pt = pointAt(seat[ri] ?? 0, n)
          return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
        })
        .join(' '),
    )
  }

  function paintFoot(): void {
    const left = hintsLeft(state)
    hintBtn.textContent = `💡 Hint (${left} left)`
    hintBtn.disabled = left <= 0 || state.status !== 'play'
  }

  /** A line under the bench, for a beat. */
  function note(msg: string): void {
    noteEl.textContent = msg
    noteEl.hidden = false
    after(NOTE_MS, () => {
      if (noteEl.textContent === msg) noteEl.hidden = true
    })
  }

  function clearNote(): void {
    noteEl.hidden = true
  }

  /** The word that would not go in: it stays up, shakes, and then clears. */
  function bounce(word: string, msg: string): void {
    note(msg)
    say(msg)
    if (reducedMotion()) {
      paintPicks()
      return
    }
    paintPicks(word)
    bench.classList.remove('shake')
    void bench.offsetWidth // a reflow, so a second bad word shakes again
    bench.classList.add('shake')
    after(SHAKE_MS, () => {
      bench.classList.remove('shake')
      paintPicks()
    })
  }

  /* ---------------- the moves ---------------- */

  /** Which ring index is laid out where, and in what order. */
  function layOut(seed?: number): number[] {
    const ids = roundOf(state).ring.map((_, i) => String(i))
    // The wheel starts in the round's own order and is only ever re-laid on
    // request, so a player who looks away does not lose their place.
    return seed == null ? ids.map(Number) : shuffle(ids, seed).map(Number)
  }

  function onPick(ringIndex: number): boolean {
    const next = pick(state, ringIndex)
    if (next === state) return false
    state = next
    clearNote()
    paintPicks()
    return true
  }

  function onBack(): void {
    const next = unpick(state)
    if (next === state) return
    state = next
    paintPicks()
  }

  function onType(ch: string): void {
    const up = ch.toUpperCase()
    // The first tile carrying that letter that is not already in the word — the
    // two Ks of round one are interchangeable, so typing is never ambiguous.
    const i = roundOf(state).ring.findIndex((l, idx) => l === up && !state.picked.includes(idx))
    if (i >= 0) onPick(i)
  }

  function onShuffle(): void {
    if (state.status !== 'play') return
    order = layOut(++shuffles * 97 + state.round * 13 + 1)
    paintWheel()
    paintPicks()
  }

  function onHint(): void {
    const before = state
    state = hint(state)
    if (state === before) return
    paintSlots()
    paintFoot()
    const w = roundOf(state).words.find((x) => (state.revealed[x.word] ?? 0) > (before.revealed[x.word] ?? 0))
    const n = w ? (state.revealed[w.word] ?? 0) : 0
    say(w ? `${groupOf(w.skill)}: ${w.word[n - 1]}.` : 'A letter, on the house.')
    sfx.ding()
  }

  function onEnter(): void {
    if (state.status !== 'play') return
    const before = state
    const word = current(state)
    const out = submit(state)
    state = out.state
    if (out.result === 'found') {
      onFound(before)
      return
    }
    if (out.result === 'miss') {
      sfx.bonk()
      bounce(word, MISS_NOTE)
      maybeGag()
      return
    }
    paintPicks()
    if (out.result === 'dup') {
      note(DUP_NOTE)
      say(DUP_NOTE)
    } else {
      note(SHORT_NOTE)
      say(SHORT_NOTE)
    }
  }

  /**
   * A word landed — by hand or by the Hire-me reveal. The chip toast is the
   * payoff the whole game is built around: the tool, and where it sits on the
   * card. The wall it landed on is painted first, so the slot is still there to
   * light up before the round turns over.
   */
  function onFound(before: ForgeState): void {
    const round = roundOf(before)
    const word = state.found.find((w) => !before.found.includes(w))
    const hit = round.words.find((w) => w.word === word)
    clearNote()
    paintSlots(round)
    paintPicks()
    paintFoot()
    if (hit) {
      const clue = groupOf(hit.skill)
      events.emit('ui:toast', { kind: 'info', icon: '🔧', title: `${hit.word} — ${hit.skill}`, sub: clue })
      say(`${hit.word}. ${hit.skill} — ${clue}.`)
      sfx.pickup()
      const slot = slotList.querySelector<HTMLElement>(`[data-word="${hit.word}"]`)
      if (slot && !reducedMotion()) {
        slot.classList.add('flash')
        after(FLASH_MS, () => slot.classList.remove('flash'))
      }
    }
    if (state.round === before.round) return
    // A fresh wheel: a fresh patience, and a fresh miss count to spend on it.
    spentMisses = 0
    if (state.status === 'won') {
      win()
      return
    }
    after(reducedMotion() ? 0 : ROUND_MS, () => {
      order = layOut()
      paintWheel()
      paintSlots()
      paintPicks()
      paintFoot()
      say('Wall cleared — Ravi hangs the next set.')
    })
  }

  function win(): void {
    say('Every tool on the wall. The Workshop is yours.')
    const beat = afterWin(() => host.close({ id: 'forge', won: true, score: FORGE_ROUNDS.length }))
    if (beat) timers.push(beat)
  }

  /**
   * Six wrong words on one wheel and Ravi puts the kettle on. The tally the
   * overlay answered is banked, so it takes six *more* to fetch it again —
   * whichever way the player took the last one.
   */
  function maybeGag(): void {
    if (state.misses - spentMisses < FORGE_MISSES) return
    spentMisses = state.misses
    host.gag({
      title: GAG_TITLE,
      sub: GAG_SUB,
      retry: () => {
        state = { ...state, misses: 0, picked: [] }
        spentMisses = 0
        clearNote()
        paintPicks()
      },
      // "Hire me" at this bench forges a whole word — the same payout as a find,
      // toast and all, so the wall reads the same however the word got there.
      hint: () => {
        const before = state
        state = revealWord(state)
        if (state !== before) onFound(before)
      },
    })
  }

  /* ---------------- input ---------------- */

  /** The pointer id that owns the current drag, or null between drags. */
  let dragId: number | null = null
  /** True once a drag has reached a *second* tile — that is what makes it a drag. */
  let dragged = false
  /**
   * When the last drag let go. A drag that ends on a tile it also passed through
   * leaves a synthesised click on that tile behind, and picking on it would
   * start the next word with a letter nobody chose. A window rather than a flag
   * on purpose: a click that never comes must not be able to eat the next tap.
   */
  let dragEndedAt = 0

  const letterUnder = (x: number, y: number): HTMLElement | null => {
    const hit = document.elementFromPoint(x, y)
    return hit instanceof HTMLElement ? hit.closest<HTMLElement>('.fg-letter') : null
  }

  wheel.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('.fg-letter')
    if (!btn || state.status !== 'play') return
    e.preventDefault()
    dragId = e.pointerId
    dragged = false
    dragEndedAt = 0
    // Capture on the wheel, not the tile: the finger leaves the tile it started
    // on immediately, and without this the move events would go with it.
    try {
      wheel.setPointerCapture(e.pointerId)
    } catch {
      // Not every browser still has this pointer by now; the drag works without it.
    }
    onPick(Number(btn.dataset.i))
  })

  wheel.addEventListener('pointermove', (e) => {
    if (dragId !== e.pointerId) return
    const btn = letterUnder(e.clientX, e.clientY)
    if (btn && onPick(Number(btn.dataset.i))) dragged = true
  })

  const endDrag = (e: PointerEvent): void => {
    if (dragId !== e.pointerId) return
    dragId = null
    try {
      wheel.releasePointerCapture(e.pointerId)
    } catch {
      // Already gone — nothing to release.
    }
    // A tap is a pointer that never reached a second tile: it leaves the letter
    // picked and waits for the next one, which is how tapping a word out works.
    if (!dragged) return
    dragEndedAt = Date.now()
    onEnter()
  }
  wheel.addEventListener('pointerup', endDrag)
  wheel.addEventListener('pointercancel', endDrag)

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t.closest('.modal-x, [data-act="quit"]')) {
      host.quit()
      return
    }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act
    if (act === 'shuffle') return onShuffle()
    if (act === 'hint') return onHint()
    if (act === 'enter') return onEnter()
    if (act === 'back') return onBack()
    const btn = t.closest<HTMLElement>('.fg-letter')
    if (!btn) return
    if (Date.now() - dragEndedAt < DRAG_CLICK_MS) return
    onPick(Number(btn.dataset.i))
  })

  // Element-scoped, never `core/keys`: the world must not hear a word being
  // typed at it. Escape is left alone — the host's own handler, one level up on
  // the modal panel, is what asks before throwing a round away.
  root.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    const onControl = t instanceof HTMLElement && t !== root && !!t.closest('button, a')
    if (e.key === 'Enter') {
      // A focused button activates itself; stealing Enter would double-fire it.
      if (onControl) return
      e.preventDefault()
      e.stopPropagation()
      onEnter()
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      onBack()
    } else if (/^[a-z]$/i.test(e.key)) {
      e.stopPropagation()
      onType(e.key)
    }
  })

  order = layOut()
  paintWheel()
  paintSlots()
  paintPicks()
  paintFoot()
  root.tabIndex = 0
  root.dataset.autofocus = '' // brings focus back here when the gag closes
  root.focus({ preventScroll: true })

  return {
    // Wheels finished. A round abandoned halfway still says how far it got.
    score: () => state.round,
    // The wall is full the moment the last word lands, but the close is a beat
    // later; anything that shuts the dialog inside that beat is still a win.
    won: () => state.status === 'won',
    destroy: clearTimers,
  }
}
