// Generates every asset in labelled steps (one per frame) so the loading bar
// reflects real work, then hands off to the world in title mode.
import Phaser from 'phaser'
import { buildAtlas, createAnims } from '../art/atlas'
import { toCanvas } from '../art/pixel'
import { WORLD_SEED } from '../config'
import { events } from '../core/events'
import { makeRng } from '../core/rng'
import { bakeChunk, bakeMinimap, chunkList } from '../world/bake'
import { BLUEPRINT, rasterizeBlueprint } from '../world/blueprint'
import { scatterDecor, type Decor } from '../world/scatter'
import type { Grid } from '../world/terrain'
import { InteriorScene } from './InteriorScene'
import { NPC_INFO, NPC_TREES } from '../data/npcs'
import { registerTrees } from '../systems/DialogueRegistry'

export type WorldData = {
  grid: Grid
  chunks: { cx: number; cy: number; x: number; y: number; key: string }[]
  decor: Decor[]
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create() {
    registerTrees(NPC_TREES, NPC_INFO)
    if (!this.scene.get('interior')) this.scene.add('interior', InteriorScene, false)
    let grid: Grid | null = null
    let decor: Decor[] = []
    const chunks: WorldData['chunks'] = []
    const steps: { label: string; run: () => void }[] = [
      {
        label: 'Painting sprites',
        run: () => {
          buildAtlas(this)
          createAnims(this)
        },
      },
      {
        label: 'Shaping the coast',
        run: () => {
          grid = rasterizeBlueprint(BLUEPRINT, makeRng(WORLD_SEED))
        },
      },
    ]
    for (const { cx, cy } of chunkList())
      steps.push({
        label: 'Baking the island',
        run: () => {
          const c = bakeChunk(grid!, cx, cy)
          const key = `chunk_${cx}_${cy}`
          this.textures.addCanvas(key, toCanvas(c.raster))
          chunks.push({ cx, cy, x: c.x, y: c.y, key })
        },
      })
    steps.push({
      label: 'Planting the woods',
      run: () => {
        decor = scatterDecor(grid!, BLUEPRINT, makeRng(WORLD_SEED).fork('scatter'))
      },
    })
    steps.push({
      label: 'Drawing the map',
      run: () => {
        this.textures.addCanvas('minimap', toCanvas(bakeMinimap(grid!, 2)))
      },
    })

    let i = 0
    const tick = () => {
      if (i >= steps.length) {
        const data: WorldData = { grid: grid!, chunks, decor }
        this.registry.set('world', data)
        events.emit('load:progress', { pct: 100, label: 'Welcome' })
        this.scene.start('world', { mode: 'title' })
        return
      }
      const s = steps[i++]
      events.emit('load:progress', { pct: Math.round((i / (steps.length + 1)) * 100), label: s.label })
      try {
        s.run()
      } catch (err) {
        console.error(`Boot step failed: ${s.label}`, err)
        throw err
      }
      this.time.delayedCall(0, tick)
    }
    tick()
  }
}
