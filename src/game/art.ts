import Phaser from 'phaser'
import { TILES_W, TILES_H } from '../data/content'

export const TILE = 32
export const WORLD_W = TILES_W * TILE
export const WORLD_H = TILES_H * TILE

type Ctx = CanvasRenderingContext2D

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) return
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  scene.textures.addCanvas(key, canvas)
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function softShadow(c: Ctx, x: number, y: number, rx: number, ry: number) {
  c.save()
  c.fillStyle = 'rgba(20,40,20,0.18)'
  c.beginPath()
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

/* ---------- the island ground (one big organic texture) ---------- */
export function buildIsland(scene: Phaser.Scene, zones: { tx: number; ty: number }[], spawn: { tx: number; ty: number }) {
  const W = WORLD_W
  const H = WORLD_H
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  // --- water base ---
  const wg = c.createLinearGradient(0, 0, 0, H)
  wg.addColorStop(0, '#6fc0ea')
  wg.addColorStop(1, '#57a9dd')
  c.fillStyle = wg
  c.fillRect(0, 0, W, H)
  // gentle wave streaks
  c.strokeStyle = 'rgba(255,255,255,0.18)'
  c.lineWidth = 3
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    c.beginPath()
    c.moveTo(x, y)
    c.quadraticCurveTo(x + 10, y - 5, x + 22, y)
    c.stroke()
  }

  // --- island landmass (irregular coast) ---
  const cx = W / 2
  const cy = H / 2
  const baseR = Math.min(W, H) * 0.46
  const N = 30
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const r =
      baseR *
      (0.84 +
        0.12 * Math.sin(a * 3 + 1.3) +
        0.08 * Math.sin(a * 5 + 0.4) +
        0.05 * Math.sin(a * 8 + 2.1)) *
      (W / H > 1 ? 1 : 1)
    pts.push({ x: cx + Math.cos(a) * r * 1.32, y: cy + Math.sin(a) * r })
  }
  const island = new Path2D()
  const beach = new Path2D()
  const grass = new Path2D()
  const buildBlob = (path: Path2D, scale: number) => {
    for (let i = 0; i <= N; i++) {
      const p0 = pts[(i - 1 + N) % N]
      const p1 = pts[i % N]
      const sx0 = cx + (p0.x - cx) * scale
      const sy0 = cy + (p0.y - cy) * scale
      const sx1 = cx + (p1.x - cx) * scale
      const sy1 = cy + (p1.y - cy) * scale
      const mx = (sx0 + sx1) / 2
      const my = (sy0 + sy1) / 2
      if (i === 0) path.moveTo(mx, my)
      else path.quadraticCurveTo(sx0, sy0, mx, my)
    }
    path.closePath()
  }
  buildBlob(island, 1.0)
  buildBlob(beach, 1.0)
  buildBlob(grass, 0.94)

  // beach (sand ring)
  c.fillStyle = '#ecdca6'
  c.fill(beach)
  // soft shoreline foam
  c.save()
  c.clip(beach)
  c.strokeStyle = 'rgba(255,255,255,0.5)'
  c.lineWidth = 10
  c.stroke(beach)
  c.restore()

  // grass
  const gg = c.createLinearGradient(0, cy - baseR, 0, cy + baseR)
  gg.addColorStop(0, '#8fce5a')
  gg.addColorStop(1, '#7cbd4c')
  c.save()
  c.clip(grass)
  c.fillStyle = gg
  c.fillRect(0, 0, W, H)
  // grass texture: scattered tufts + speckles
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const dark = Math.random() < 0.5
    c.fillStyle = dark ? 'rgba(80,150,55,0.5)' : 'rgba(180,220,120,0.45)'
    c.beginPath()
    c.ellipse(x, y, 2.5 + Math.random() * 2, 1.6 + Math.random() * 1.4, 0, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()

  // --- roads (dirt paths between spawn and zones) ---
  const toW = (t: { tx: number; ty: number }) => ({ x: t.tx * TILE + TILE / 2, y: t.ty * TILE + TILE / 2 })
  const hub = toW(spawn)
  c.save()
  c.clip(grass)
  c.lineCap = 'round'
  c.lineJoin = 'round'
  for (const z of zones) {
    const a = hub
    const b = toW(z)
    const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 120
    const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 120
    // outer dirt
    c.strokeStyle = '#cda86a'
    c.lineWidth = 26
    c.beginPath()
    c.moveTo(a.x, a.y)
    c.quadraticCurveTo(mx, my, b.x, b.y)
    c.stroke()
    // lighter inner
    c.strokeStyle = '#e2c790'
    c.lineWidth = 16
    c.beginPath()
    c.moveTo(a.x, a.y)
    c.quadraticCurveTo(mx, my, b.x, b.y)
    c.stroke()
  }
  // little plaza at hub
  c.fillStyle = '#e2c790'
  c.beginPath()
  c.arc(hub.x, hub.y, 46, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#cda86a'
  c.beginPath()
  c.arc(hub.x, hub.y, 46, 0, Math.PI * 2)
  c.lineWidth = 6
  c.strokeStyle = '#cda86a'
  c.stroke()
  c.restore()

  scene.textures.addCanvas('island', canvas)

  // collision helper: walkable if inside the beach blob (with margin)
  const mctx = document.createElement('canvas').getContext('2d')!
  const isLand = (x: number, y: number) => mctx.isPointInPath(beach, x, y)
  return { isLand }
}

/* ---------- decorations ---------- */
function drawTree(c: Ctx) {
  softShadow(c, 32, 60, 20, 7)
  // trunk
  c.fillStyle = '#8a5a3b'
  roundRect(c, 27, 40, 10, 22, 4)
  c.fill()
  // canopy layers
  const blobs = [
    [32, 26, 22, '#4f9e36'],
    [22, 30, 15, '#5cb142'],
    [42, 30, 15, '#5cb142'],
    [32, 20, 18, '#6cc24f'],
    [28, 24, 9, '#8fd86a'],
  ] as const
  for (const [x, y, r, col] of blobs) {
    c.fillStyle = col as string
    c.beginPath()
    c.arc(x as number, y as number, r as number, 0, Math.PI * 2)
    c.fill()
  }
}

function drawBush(c: Ctx) {
  softShadow(c, 24, 30, 16, 5)
  const blobs = [
    [16, 20, 11, '#54a83a'],
    [30, 20, 11, '#54a83a'],
    [23, 15, 12, '#64bd49'],
    [22, 13, 5, '#86d264'],
  ] as const
  for (const [x, y, r, col] of blobs) {
    c.fillStyle = col as string
    c.beginPath()
    c.arc(x as number, y as number, r as number, 0, Math.PI * 2)
    c.fill()
  }
}

function drawFlowers(c: Ctx) {
  const cols = ['#ff8fb0', '#ffe27a', '#b08bff', '#ffffff']
  for (let i = 0; i < 5; i++) {
    const x = 6 + Math.random() * 24
    const y = 10 + Math.random() * 16
    c.fillStyle = '#3f8a3a'
    c.fillRect(x - 0.5, y, 1.5, 8)
    c.fillStyle = cols[(Math.random() * cols.length) | 0]
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2
      c.beginPath()
      c.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, Math.PI * 2)
      c.fill()
    }
    c.fillStyle = '#ffd54a'
    c.beginPath()
    c.arc(x, y, 1.8, 0, Math.PI * 2)
    c.fill()
  }
}

function drawRock(c: Ctx) {
  softShadow(c, 18, 24, 13, 4)
  c.fillStyle = '#9aa3ad'
  c.beginPath()
  c.moveTo(6, 24)
  c.lineTo(10, 12)
  c.lineTo(20, 9)
  c.lineTo(30, 16)
  c.lineTo(28, 24)
  c.closePath()
  c.fill()
  c.fillStyle = '#b7bfc8'
  c.beginPath()
  c.moveTo(10, 12)
  c.lineTo(20, 9)
  c.lineTo(20, 16)
  c.lineTo(13, 18)
  c.closePath()
  c.fill()
}

function drawSign(c: Ctx) {
  softShadow(c, 16, 34, 9, 3)
  c.fillStyle = '#8a5a3b'
  c.fillRect(14, 16, 4, 18)
  c.fillStyle = '#b97f4e'
  roundRect(c, 3, 6, 26, 14, 3)
  c.fill()
  c.fillStyle = '#e7c79a'
  roundRect(c, 5, 8, 22, 10, 2)
  c.fill()
  c.fillStyle = '#8a5a3b'
  for (let i = 0; i < 3; i++) c.fillRect(8, 10 + i * 3, 16, 1.4)
}

/* ---------- landmarks (cute buildings) ---------- */
function base(c: Ctx, w: number, h: number) {
  softShadow(c, w / 2, h - 8, w * 0.42, 9)
}
function roof(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col
  c.beginPath()
  c.moveTo(x - 6, y + h)
  c.lineTo(x + w / 2, y)
  c.lineTo(x + w + 6, y + h)
  c.closePath()
  c.fill()
}
function door(c: Ctx, x: number, y: number, w: number, h: number) {
  c.fillStyle = '#7a4a2c'
  roundRect(c, x, y, w, h, 4)
  c.fill()
  c.fillStyle = '#ffd54a'
  c.beginPath()
  c.arc(x + w - 4, y + h / 2, 1.6, 0, Math.PI * 2)
  c.fill()
}
function window2(c: Ctx, x: number, y: number, s: number, col = '#bfe6ff') {
  c.fillStyle = '#fff7e0'
  roundRect(c, x - 1, y - 1, s + 2, s + 2, 2)
  c.fill()
  c.fillStyle = col
  roundRect(c, x, y, s, s, 2)
  c.fill()
}

function drawHome(c: Ctx) {
  const W = 84
  const H = 84
  base(c, W, H)
  c.fillStyle = '#f3e2c0'
  roundRect(c, 14, 34, 56, 42, 6)
  c.fill()
  roof(c, 10, 14, 64, 24, '#e06b5e')
  door(c, 36, 52, 14, 24)
  window2(c, 20, 42, 12)
  window2(c, 52, 42, 12)
  // chimney puff
  c.fillStyle = '#b97f4e'
  c.fillRect(54, 16, 8, 12)
}

function drawTower(c: Ctx) {
  const W = 84
  base(c, W, 110)
  c.fillStyle = '#dfe8f2'
  roundRect(c, 26, 18, 32, 86, 6)
  c.fill()
  c.fillStyle = '#5b9bd5'
  roundRect(c, 26, 18, 32, 14, 6)
  c.fill()
  for (let r = 0; r < 5; r++)
    for (let col = 0; col < 2; col++) window2(c, 32 + col * 14, 38 + r * 13, 8, '#9fd0f5')
  // flag
  c.strokeStyle = '#888'
  c.lineWidth = 2
  c.beginPath()
  c.moveTo(42, 18)
  c.lineTo(42, 6)
  c.stroke()
  c.fillStyle = '#1d4e89'
  c.beginPath()
  c.moveTo(42, 6)
  c.lineTo(56, 9)
  c.lineTo(42, 13)
  c.closePath()
  c.fill()
}

function drawWorkshop(c: Ctx) {
  const W = 92
  base(c, W, 80)
  c.fillStyle = '#caa46f'
  roundRect(c, 12, 36, 68, 40, 6)
  c.fill()
  // big slanted roof
  c.fillStyle = '#ff7a59'
  c.beginPath()
  c.moveTo(6, 40)
  c.lineTo(46, 16)
  c.lineTo(86, 40)
  c.closePath()
  c.fill()
  door(c, 36, 52, 18, 24)
  window2(c, 18, 44, 12, '#ffe9a8')
  window2(c, 62, 44, 12, '#ffe9a8')
  // gear sign
  c.fillStyle = '#5b4636'
  c.beginPath()
  c.arc(46, 30, 6, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#caa46f'
  c.beginPath()
  c.arc(46, 30, 2.5, 0, Math.PI * 2)
  c.fill()
}

function drawEngine(c: Ctx) {
  const W = 92
  base(c, W, 80)
  c.fillStyle = '#2c3a4a'
  roundRect(c, 14, 30, 64, 46, 6)
  c.fill()
  // glowing core
  c.fillStyle = '#0e2730'
  roundRect(c, 24, 40, 44, 26, 4)
  c.fill()
  const grd = c.createRadialGradient(46, 53, 2, 46, 53, 18)
  grd.addColorStop(0, '#9bf6e6')
  grd.addColorStop(1, 'rgba(94,234,212,0)')
  c.fillStyle = grd
  c.fillRect(24, 40, 44, 26)
  c.fillStyle = '#5eead4'
  c.beginPath()
  c.arc(46, 53, 5, 0, Math.PI * 2)
  c.fill()
  // pipes
  c.strokeStyle = '#4a5a6a'
  c.lineWidth = 6
  c.beginPath()
  c.moveTo(14, 36)
  c.lineTo(4, 36)
  c.moveTo(78, 36)
  c.lineTo(88, 36)
  c.stroke()
  // chimneys
  c.fillStyle = '#3a4a5a'
  c.fillRect(26, 18, 9, 14)
  c.fillRect(57, 18, 9, 14)
}

function drawVault(c: Ctx) {
  const W = 80
  base(c, W, 78)
  c.fillStyle = '#3a3550'
  roundRect(c, 16, 30, 48, 46, 6)
  c.fill()
  c.fillStyle = '#4a4468'
  roundRect(c, 24, 38, 32, 32, 4)
  c.fill()
  // lock
  c.strokeStyle = '#b794f6'
  c.lineWidth = 3
  c.beginPath()
  c.arc(40, 50, 6, Math.PI, 0)
  c.stroke()
  c.fillStyle = '#b794f6'
  roundRect(c, 33, 50, 14, 12, 2)
  c.fill()
  c.fillStyle = '#3a3550'
  c.beginPath()
  c.arc(40, 56, 1.6, 0, Math.PI * 2)
  c.fill()
  // caution tape
  c.fillStyle = 'rgba(255,194,75,0.85)'
  c.fillRect(12, 28, 56, 6)
}

function drawCottage(c: Ctx) {
  const W = 84
  base(c, W, 80)
  c.fillStyle = '#eaf3df'
  roundRect(c, 16, 36, 52, 40, 6)
  c.fill()
  roof(c, 12, 18, 60, 22, '#59c08a')
  door(c, 36, 54, 14, 22)
  window2(c, 22, 44, 11, '#cfeede')
  window2(c, 50, 44, 11, '#cfeede')
  // heart sign
  c.fillStyle = '#ff6b8a'
  c.beginPath()
  c.arc(36, 29, 3, 0, Math.PI * 2)
  c.arc(42, 29, 3, 0, Math.PI * 2)
  c.moveTo(33, 30)
  c.lineTo(39, 36)
  c.lineTo(45, 30)
  c.closePath()
  c.fill()
}

function drawLighthouse(c: Ctx) {
  const W = 64
  base(c, W, 116)
  c.fillStyle = '#f4f1ea'
  c.beginPath()
  c.moveTo(22, 110)
  c.lineTo(26, 34)
  c.lineTo(38, 34)
  c.lineTo(42, 110)
  c.closePath()
  c.fill()
  // red stripes
  c.fillStyle = '#e8584e'
  for (let i = 0; i < 3; i++) {
    const y = 44 + i * 22
    c.beginPath()
    c.moveTo(23.5 + i * 0.1, y)
    c.lineTo(40.5 - i * 0.1, y)
    c.lineTo(41, y + 11)
    c.lineTo(23, y + 11)
    c.closePath()
    c.fill()
  }
  // lamp
  c.fillStyle = '#3a3a3a'
  roundRect(c, 24, 22, 16, 12, 2)
  c.fill()
  c.fillStyle = '#fff3b0'
  c.beginPath()
  c.arc(32, 28, 5, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#c84a40'
  c.beginPath()
  c.moveTo(24, 22)
  c.lineTo(32, 14)
  c.lineTo(40, 22)
  c.closePath()
  c.fill()
}

/* ---------- the cute avatar (a little "byte buddy") ---------- */
function drawHero(c: Ctx, dir: 'down' | 'up' | 'side', frame: number) {
  const cx = 16
  const bob = frame === 1 ? -1 : 0
  // shadow
  c.fillStyle = 'rgba(20,40,20,0.2)'
  c.beginPath()
  c.ellipse(cx, 28, 9, 3.4, 0, 0, Math.PI * 2)
  c.fill()
  // feet (alternate)
  c.fillStyle = '#e07a3a'
  const lift = frame === 1 ? 2 : 0
  c.beginPath()
  c.ellipse(cx - 4, 25 - lift, 3, 2.4, 0, 0, Math.PI * 2)
  c.fill()
  c.beginPath()
  c.ellipse(cx + 4, 25 - (2 - lift), 3, 2.4, 0, 0, Math.PI * 2)
  c.fill()
  // ears
  c.fillStyle = '#ff9d5c'
  c.beginPath()
  c.moveTo(cx - 7, 9 + bob)
  c.lineTo(cx - 9, 2 + bob)
  c.lineTo(cx - 3, 7 + bob)
  c.closePath()
  c.fill()
  c.beginPath()
  c.moveTo(cx + 7, 9 + bob)
  c.lineTo(cx + 9, 2 + bob)
  c.lineTo(cx + 3, 7 + bob)
  c.closePath()
  c.fill()
  // body
  const bg = c.createLinearGradient(0, 6 + bob, 0, 26 + bob)
  bg.addColorStop(0, '#ffb074')
  bg.addColorStop(1, '#ff9148')
  c.fillStyle = bg
  c.beginPath()
  c.ellipse(cx, 16 + bob, 10, 11, 0, 0, Math.PI * 2)
  c.fill()
  // belly
  c.fillStyle = '#ffe7cf'
  c.beginPath()
  c.ellipse(cx, 19 + bob, 6, 6.5, 0, 0, Math.PI * 2)
  c.fill()
  if (dir === 'up') {
    // back of head — no face
    c.fillStyle = '#ff9148'
    c.beginPath()
    c.ellipse(cx, 14 + bob, 9, 9, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#ffb074'
    c.beginPath()
    c.arc(cx, 12 + bob, 3, 0, Math.PI * 2)
    c.fill()
    return
  }
  // eyes
  const ex = dir === 'side' ? cx + 1 : cx
  c.fillStyle = '#2a2433'
  c.beginPath()
  c.arc(ex - 3.4, 14 + bob, 1.9, 0, Math.PI * 2)
  c.fill()
  c.beginPath()
  c.arc(ex + 3.4, 14 + bob, 1.9, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#fff'
  c.beginPath()
  c.arc(ex - 4, 13.3 + bob, 0.7, 0, Math.PI * 2)
  c.arc(ex + 2.8, 13.3 + bob, 0.7, 0, Math.PI * 2)
  c.fill()
  // cheeks + smile
  c.fillStyle = 'rgba(255,120,120,0.4)'
  c.beginPath()
  c.arc(ex - 5.5, 17 + bob, 1.6, 0, Math.PI * 2)
  c.arc(ex + 5.5, 17 + bob, 1.6, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = '#2a2433'
  c.lineWidth = 1
  c.beginPath()
  c.arc(ex, 17 + bob, 2.4, 0.15 * Math.PI, 0.85 * Math.PI)
  c.stroke()
}

export function generateAssets(scene: Phaser.Scene) {
  // decorations
  tex(scene, 'tree', 64, 68, (c) => drawTree(c))
  tex(scene, 'bush', 48, 36, (c) => drawBush(c))
  tex(scene, 'flowers', 36, 30, (c) => drawFlowers(c))
  tex(scene, 'rock', 36, 28, (c) => drawRock(c))
  tex(scene, 'sign', 32, 38, (c) => drawSign(c))

  // landmarks
  tex(scene, 'lm_home', 84, 90, (c) => drawHome(c))
  tex(scene, 'lm_tower', 84, 116, (c) => drawTower(c))
  tex(scene, 'lm_workshop', 92, 84, (c) => drawWorkshop(c))
  tex(scene, 'lm_engine', 92, 84, (c) => drawEngine(c))
  tex(scene, 'lm_vault', 80, 82, (c) => drawVault(c))
  tex(scene, 'lm_cottage', 84, 84, (c) => drawCottage(c))
  tex(scene, 'lm_lighthouse', 64, 120, (c) => drawLighthouse(c))

  // avatar frames
  const dirs: ('down' | 'up' | 'side')[] = ['down', 'up', 'side']
  for (const d of dirs) {
    for (let f = 0; f < 2; f++) tex(scene, `hero_${d}_${f}`, 32, 32, (c) => drawHero(c, d, f))
  }

  // collectible orb
  tex(scene, 'orb', 22, 22, (c) => {
    const g = c.createRadialGradient(11, 9, 1, 11, 11, 10)
    g.addColorStop(0, '#dffcff')
    g.addColorStop(0.5, '#5eead4')
    g.addColorStop(1, '#2bbfae')
    c.fillStyle = g
    c.beginPath()
    c.arc(11, 11, 9, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgba(255,255,255,0.85)'
    c.beginPath()
    c.arc(8, 8, 2.4, 0, Math.PI * 2)
    c.fill()
  })

  // particles
  tex(scene, 'dust', 12, 12, (c) => {
    c.fillStyle = 'rgba(220,205,170,0.9)'
    c.beginPath()
    c.arc(6, 6, 5, 0, Math.PI * 2)
    c.fill()
  })
  tex(scene, 'spark', 10, 10, (c) => {
    c.fillStyle = '#fff7c0'
    c.beginPath()
    c.arc(5, 5, 4, 0, Math.PI * 2)
    c.fill()
  })

  // interaction marker ring (glow)
  tex(scene, 'ring', 64, 64, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)'
    c.lineWidth = 4
    c.beginPath()
    c.arc(32, 32, 26, 0, Math.PI * 2)
    c.stroke()
  })
}
