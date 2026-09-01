// The Engine console: a live pixel diagram of the payment lineage engine —
// packets hop Ingress → … → Ledger while the stitched path lights up below.
import { ZONES } from '../data/content'
import { el, openModal } from './modal'
import { accentOf, contentHTML, panelHead, registerPanel, wireClose } from './panels'
import { reducedMotion } from './state'

const NODES = ['Ingress', 'Tokenise', 'Classify', 'Map', 'Stitch', 'Ledger']
const W = 320
const H = 150
const X0 = 8
const NODE_W = 40
const NODE_H = 20
const NODE_Y = 40
const PATH_Y = 106
const STEP = (W - X0 * 2 - NODE_W) / (NODES.length - 1)

const INK = '#14132a'
const GRID = '#201e3c'
const BOX = '#232145'
const EDGE = '#3d3b5c'
const SEG_OFF = '#262443'
const TEAL = '#5eead4'
const TEAL_SOFT = '#2b6b60'
const MINT = '#8ff0e0'
const CREAM = '#f6e7c9'
const YELLOW = '#ffd23f'
const PACKET_COLORS = ['#ffd23f', '#8ff0e0', '#f28c28', '#9b6bf2', '#59f3a6']

type Packet = { hop: number; t: number; c: string }

const nodeLeft = (i: number) => Math.round(X0 + i * STEP)
const nodeCX = (i: number) => nodeLeft(i) + NODE_W / 2
const smoothT = (t: number) => t * t * (3 - 2 * t)

function startEngine(canvas: HTMLCanvasElement, countEl: HTMLElement): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  ctx.scale(canvas.width / W, canvas.height / H)

  const packets: Packet[] = []
  const segGlow = new Array<number>(NODES.length - 1).fill(0)
  const segLit = new Array<boolean>(NODES.length - 1).fill(false)
  const nodeGlow = new Array<number>(NODES.length).fill(0)
  let spawnIn = 0.2
  let count = 0
  let stitched = 0

  const draw = () => {
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = INK
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = GRID
    for (let y = 6; y < H; y += 12) for (let x = 6; x < W; x += 12) ctx.fillRect(x, y, 1, 1)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.font = '6px "Press Start 2P", monospace'
    ctx.fillStyle = MINT
    ctx.fillText('PAYMENT LINEAGE — LIVE', 8, 16)
    ctx.textAlign = 'right'
    ctx.fillStyle = stitched > 0.02 ? YELLOW : EDGE
    ctx.fillText(stitched > 0.02 ? 'PATH STITCHED ✓' : '· · ·', W - 8, 16)

    // wires between the stages
    const wy = NODE_Y + Math.floor(NODE_H / 2)
    ctx.fillStyle = EDGE
    for (let i = 0; i < NODES.length - 1; i++) ctx.fillRect(nodeLeft(i) + NODE_W, wy, nodeLeft(i + 1) - nodeLeft(i) - NODE_W, 2)

    // stage boxes + labels
    ctx.textAlign = 'center'
    ctx.font = '5px "Press Start 2P", monospace'
    for (let i = 0; i < NODES.length; i++) {
      const x = nodeLeft(i)
      const hot = nodeGlow[i] > 0.05
      ctx.fillStyle = hot ? TEAL : EDGE
      ctx.fillRect(x - 1, NODE_Y - 1, NODE_W + 2, NODE_H + 2)
      ctx.fillStyle = BOX
      ctx.fillRect(x, NODE_Y, NODE_W, NODE_H)
      ctx.fillStyle = hot ? MINT : TEAL
      ctx.fillRect(x + 3, NODE_Y + 3, 4, 4)
      ctx.fillStyle = CREAM
      ctx.fillText(NODES[i], nodeCX(i), NODE_Y + NODE_H + 10)
    }

    // packets with glowing trails
    for (const p of packets) {
      if (p.hop >= NODES.length - 1) continue
      for (let k = 3; k >= 0; k--) {
        const t = Math.max(0, p.t - k * 0.09)
        const e = smoothT(Math.min(1, t))
        const x = Math.round(nodeCX(p.hop) + (nodeCX(p.hop + 1) - nodeCX(p.hop)) * e)
        const y = wy - 2 + Math.round(Math.sin((p.t + k * 0.09) * Math.PI * 2) * 1.5)
        ctx.globalAlpha = k === 0 ? 1 : Math.max(0.06, 0.3 - k * 0.07)
        ctx.fillStyle = p.c
        const s = k === 0 ? 5 : 4
        ctx.fillRect(x - 2, y - 1, s, s)
      }
      ctx.globalAlpha = 1
    }

    // the stitched end-to-end path
    ctx.textAlign = 'left'
    ctx.font = '5px "Press Start 2P", monospace'
    ctx.fillStyle = EDGE
    ctx.fillText('END-TO-END PATH', 8, PATH_Y - 10)
    for (let i = 0; i < NODES.length - 1; i++) {
      const x0 = nodeCX(i)
      const x1 = nodeCX(i + 1)
      ctx.fillStyle = segLit[i] ? TEAL_SOFT : SEG_OFF
      ctx.fillRect(x0, PATH_Y, x1 - x0, 2)
      if (segGlow[i] > 0.02) {
        ctx.globalAlpha = Math.min(1, segGlow[i])
        ctx.fillStyle = TEAL
        ctx.fillRect(x0, PATH_Y - 1, x1 - x0, 4)
        ctx.globalAlpha = 1
      }
    }
    if (stitched > 0.02) {
      ctx.globalAlpha = Math.min(1, stitched)
      ctx.fillStyle = YELLOW
      ctx.fillRect(nodeCX(0), PATH_Y, nodeCX(NODES.length - 1) - nodeCX(0), 2)
      ctx.globalAlpha = 1
    }
    for (let i = 0; i < NODES.length; i++) {
      const lit = i === 0 ? true : segLit[i - 1]
      ctx.fillStyle = lit ? TEAL : EDGE
      ctx.fillRect(nodeCX(i) - 2, PATH_Y - 2, 5, 5)
    }
  }

  if (reducedMotion()) {
    for (let i = 0; i < segLit.length; i++) segLit[i] = true
    packets.push({ hop: 1, t: 0.5, c: PACKET_COLORS[0] }, { hop: 3, t: 0.2, c: PACKET_COLORS[1] })
    count = 750_000_000
    countEl.textContent = count.toLocaleString('en-US')
    draw()
    return () => {}
  }

  const tickMs = 1000 / 30
  const timer = window.setInterval(() => {
    const dt = tickMs / 1000
    spawnIn -= dt
    if (spawnIn <= 0 && packets.length < 6) {
      spawnIn = 0.5 + Math.random() * 0.6
      packets.push({ hop: 0, t: 0, c: PACKET_COLORS[Math.floor(Math.random() * PACKET_COLORS.length)] })
      nodeGlow[0] = 1
    }
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i]
      p.t += dt / 0.42
      if (p.t >= 1) {
        segGlow[p.hop] = 1
        segLit[p.hop] = true
        p.hop++
        p.t = 0
        nodeGlow[p.hop] = 1
        if (p.hop >= NODES.length - 1) {
          packets.splice(i, 1)
          stitched = 1
          count += 4000 + Math.floor(Math.random() * 9000)
        }
      }
    }
    for (let i = 0; i < segGlow.length; i++) segGlow[i] = Math.max(0, segGlow[i] - dt * 1.6)
    for (let i = 0; i < nodeGlow.length; i++) nodeGlow[i] = Math.max(0, nodeGlow[i] - dt * 2.5)
    stitched = Math.max(0, stitched - dt * 1.2)
    count += Math.floor(2000 + Math.random() * 6800)
    countEl.textContent = count.toLocaleString('en-US')
    draw()
  }, tickMs)
  return () => window.clearInterval(timer)
}

export function openLineage(): void {
  const zone = ZONES.find((z) => z.id === 'lineage')
  if (!zone) return
  const box = el('div', 'engine')
  box.style.setProperty('--accent', accentOf(zone))
  box.dataset.width = '760px'
  box.innerHTML = `${panelHead('The Engine', 'LIVE CONSOLE')}
    <div class="engine-screen">
      <canvas class="engine-canvas" width="${W * 2}" height="${H * 2}" role="img" aria-label="Animation: packets flow from Ingress through Tokenise, Classify, Map and Stitch into the Ledger while the stitched end-to-end path lights up below."></canvas>
      <div class="engine-readout"><span class="engine-count">0</span><span class="engine-rate">records stitched · ≈ 750M records / day</span></div>
    </div>
    <div class="book-page">${contentHTML(zone.content)}</div>
    <footer class="modal-foot engine-foot"><button type="button" class="pbtn" data-act="close">Close</button></footer>`
  const canvas = box.querySelector('canvas') as HTMLCanvasElement
  const countEl = box.querySelector('.engine-count') as HTMLElement
  const stop = startEngine(canvas, countEl)
  wireClose(box, 'lineage')
  openModal({ id: 'lineage', el: box, label: 'The Engine console', onClose: stop })
}

export function initLineage(): void {
  registerPanel('lineage', () => openLineage())
}
