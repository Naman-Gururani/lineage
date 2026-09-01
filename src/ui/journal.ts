// Journal: Quests / Achievements / Stats in a tabbed pixel notebook.
import { sfx } from '../audio/sfx'
import { ACHIEVEMENTS } from '../data/achievements'
import { ZONES } from '../data/content'
import type { QuestDef } from '../data/quests'
import { BLUEPRINT } from '../world/blueprint'
import { closeModal, el, esc, openModal } from './modal'
import { panelHead, registerPanel, wireClose } from './panels'
import { uiState } from './state'

type Tab = 'quests' | 'achievements' | 'stats'
const TABS: [Tab, string][] = [
  ['quests', 'Quests'],
  ['achievements', 'Achievements'],
  ['stats', 'Stats'],
]
let lastTab: Tab = 'quests'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

function questCard(d: QuestDef, done: boolean): string {
  const q = uiState.quests!
  const steps = d.steps
    .map((st) => {
      const n = Math.min(st.target, q.stepProgress(d.id, st.id))
      const pct = Math.round((n / st.target) * 100)
      return (
        `<li><span class="qs-text">${esc(st.text)}</span>` +
        `<span class="qs-bar" role="progressbar" aria-label="${esc(st.text)}" aria-valuemin="0" aria-valuemax="${st.target}" aria-valuenow="${n}"><i style="width:${pct}%"></i></span>` +
        `<span class="qs-n">${n}/${st.target}</span></li>`
      )
    })
    .join('')
  return `<article class="quest${done ? ' done' : ''}">
    <header><h4>${esc(d.title)}</h4>${d.giver ? `<span class="quest-giver">from ${esc(cap(d.giver))}</span>` : ''}</header>
    <p>${esc(d.desc)}</p>
    <ul class="quest-steps">${steps}</ul>
    <footer class="quest-reward">Reward · ${d.reward.xp} XP — ${esc(d.reward.text)}</footer>
  </article>`
}

function questsHTML(): string {
  const q = uiState.quests
  if (!q) return '<p class="empty">Your journal is empty — go talk to the villagers.</p>'
  const active = q.active()
  const completed = q.completed()
  let s = '<h3 class="j-section">Active</h3>'
  s += active.length ? active.map((d) => questCard(d, false)).join('') : '<p class="empty">Nothing right now — the villagers may have work for you.</p>'
  if (completed.length) s += '<h3 class="j-section">Completed</h3>' + completed.map((d) => questCard(d, true)).join('')
  return s
}

function achievementsHTML(): string {
  const a = uiState.achievements
  const unlocked = ACHIEVEMENTS.filter((d) => a?.has(d.id)).length
  const cards = ACHIEVEMENTS.map((d) => {
    const has = !!a?.has(d.id)
    const hidden = !!d.secret && !has
    return (
      `<li class="ach${has ? '' : ' locked'}${hidden ? ' secret' : ''}">` +
      `<span class="ach-ic" aria-hidden="true">${hidden ? '?' : d.icon}</span>` +
      `<b>${hidden ? '???' : esc(d.title)}</b>` +
      `<small>${hidden ? 'A secret achievement.' : esc(d.desc)}</small></li>`
    )
  }).join('')
  return `<p class="j-count">${unlocked} / ${ACHIEVEMENTS.length} unlocked</p><ul class="ach-grid">${cards}</ul>`
}

function statsHTML(): string {
  const st = uiState.stats
  const rows: [string, string][] = [
    ['Steps', st.steps.toLocaleString('en-US')],
    ['Time played', fmtTime(st.playSeconds)],
    ['Fish caught', String(st.fishCaught)],
    ['Sign bonks', String(st.bonks)],
    ['Grass cut', String(st.grassCut)],
    ['Packets', `${st.packets} / ${st.packetsTotal}`],
    ['Discoveries', `${st.discoveries.length} / ${ZONES.length}`],
    ['Regions visited', `${uiState.visitedRegions.length} / ${BLUEPRINT.regions.length}`],
  ]
  return `<dl class="stats">${rows.map(([k, v]) => `<div class="stat"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
}

export function openJournal(tab: Tab = lastTab): void {
  const box = el('div', 'journal')
  box.dataset.width = '740px'
  box.innerHTML = `${panelHead('Journal')}
    <div class="tabs" role="tablist" aria-label="Journal sections">${TABS.map(
      ([t, l]) => `<button type="button" role="tab" id="jt-${t}" aria-controls="jp-${t}" aria-selected="false" tabindex="-1" class="tab" data-tab="${t}">${l}</button>`,
    ).join('')}</div>
    ${TABS.map(([t]) => `<section role="tabpanel" id="jp-${t}" aria-labelledby="jt-${t}" class="tabpanel" hidden></section>`).join('')}`
  const tabs = Array.from(box.querySelectorAll<HTMLButtonElement>('.tab'))
  const panels = new Map<Tab, HTMLElement>()
  for (const [t] of TABS) panels.set(t, box.querySelector(`#jp-${t}`) as HTMLElement)
  const show = (t: Tab, focus = false) => {
    lastTab = t
    for (const b of tabs) {
      const on = b.dataset.tab === t
      b.setAttribute('aria-selected', String(on))
      b.tabIndex = on ? 0 : -1
      if (on && focus) b.focus({ preventScroll: true })
    }
    for (const [k, p] of panels) p.hidden = k !== t
    const p = panels.get(t)!
    p.innerHTML = t === 'quests' ? questsHTML() : t === 'achievements' ? achievementsHTML() : statsHTML()
  }
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab')
    if (b) {
      show(b.dataset.tab as Tab)
      sfx.blip()
    }
  })
  box.addEventListener('keydown', (e) => {
    if (e.key === 'j' || e.key === 'J') {
      closeModal('journal')
      e.preventDefault()
      return
    }
    if (!(e.target as HTMLElement).closest('.tab')) return
    const i = TABS.findIndex(([t]) => t === lastTab)
    if (e.key === 'ArrowRight') show(TABS[(i + 1) % TABS.length][0], true)
    else if (e.key === 'ArrowLeft') show(TABS[(i + TABS.length - 1) % TABS.length][0], true)
    else if (e.key === 'Home') show(TABS[0][0], true)
    else if (e.key === 'End') show(TABS[TABS.length - 1][0], true)
    else return
    sfx.blip()
    e.preventDefault()
  })
  wireClose(box, 'journal')
  show(tab)
  tabs.find((b) => b.dataset.tab === tab)?.setAttribute('data-autofocus', '')
  openModal({ id: 'journal', el: box, label: 'Journal' })
}

export function initJournal(): void {
  registerPanel('journal', (data) => {
    const t = (data as { tab?: Tab } | undefined)?.tab
    openJournal(t && TABS.some(([k]) => k === t) ? t : lastTab)
  })
}
