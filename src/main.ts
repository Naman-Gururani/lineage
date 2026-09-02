// Inter carries every word of running text; Pixelify Sans is the accent face
// for headings, kickers and numerals — including the labels the canvas games
// paint, which cannot reach the DOM's stylesheet and name the family instead.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/600.css'
import './styles/ui.css'
import './styles/panels.css'
import './styles/games.css'

import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { WorldScene } from './scenes/WorldScene'
import { initUI } from './ui'
import { clearSave } from './core/save'
import { events } from './core/events'
import { parseFishFlag, setForcedFish } from './data/fish'

// `?fresh=1` starts from nothing: clear the current save *and* the legacy keys
// (v1 and v2), so a reload cannot restore what the flag just threw away.
if (new URLSearchParams(location.search).has('fresh')) {
  try {
    clearSave()
  } catch {
    /* private mode / no storage: ignore */
  }
}

// `?fish=gold` puts the golden one on every hook — the one-in-twenty catch,
// on demand, for anyone being shown around.
const forced = parseFishFlag(location.search)
if (forced) setForcedFish(forced)

initUI()

function start() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#2b7fc0',
    pixelArt: true,
    roundPixels: true,
    render: { antialias: false, powerPreference: 'high-performance' },
    input: { gamepad: true },
    fps: { forceSetTimeOut: new URLSearchParams(location.search).has('st') },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    scene: [BootScene, WorldScene],
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.loop.sleep()
    else game.loop.wake()
  })
  ;(window as unknown as { __game?: Phaser.Game; __events?: typeof events }).__game = game
  ;(window as unknown as { __events?: typeof events }).__events = events
}

const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
if (fonts?.load) {
  Promise.all([fonts.load('16px Inter'), fonts.load('600 16px Inter'), fonts.load('600 16px "Pixelify Sans"')])
    .then(start)
    .catch(start)
} else {
  start()
}
