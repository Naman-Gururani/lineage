// The prize shelf in Sol's tent: the three project chapters, whichever of them
// the claw has handed over. It is a re-read spot, not a way in — a project that
// has not been won yet opens its locked card here like anywhere else.
import { sfx } from '../audio/sfx'
import { ZONES } from '../data/content'
import { el, openModal } from './modal'
import { isUnlocked, openZone, panelHead, registerPanel, wireClose, zoneRow } from './panels'

/** The three chapters the claw machine pays out, shelf order. */
export const PRIZE_IDS = ['lineage', 'safestride', 'stealth'] as const

export function openPrizes(): void {
  const zones = PRIZE_IDS.map((id) => ZONES.find((z) => z.id === id)).filter((z): z is NonNullable<typeof z> => !!z)
  const won = zones.filter((z) => isUnlocked(z.id)).length
  const box = el('div', 'prizes')
  box.dataset.width = '560px'
  box.innerHTML = `${panelHead("Sol's Prize Tent", 'PRIZE SHELF')}
    <div class="prizes-body">
      <p class="j-count">${won} / ${zones.length} prizes on the shelf</p>
      <div class="rs-list">${zones.map((z) => zoneRow(z)).join('')}</div>
    </div>
    <footer class="modal-foot"><button type="button" class="pbtn" data-act="close">Close</button></footer>`
  box.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLButtonElement>('.rs-row')
    if (!row) return
    sfx.blip()
    openZone(row.dataset.zone!)
  })
  wireClose(box, 'prizes')
  openModal({ id: 'prizes', el: box, label: 'Prize shelf' })
}

export function initPrizes(): void {
  registerPanel('prizes', () => openPrizes())
}
