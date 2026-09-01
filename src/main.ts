import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/600.css'
import '@fontsource/press-start-2p/400.css'
import './styles/ui.css'
import './styles/panels.css'

import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { WorldScene } from './scenes/WorldScene'
import { initUI } from './ui'
import { events } from './core/events'

if (new URLSearchParams(location.search).has('fresh')) {
  try {
    localStorage.removeItem('nw2.save.v1')
  } catch {
    /* ignore */
  }
}

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
  Promise.all([fonts.load('16px "Press Start 2P"'), fonts.load('16px "Pixelify Sans"'), fonts.load('600 16px Fredoka')])
    .then(start)
    .catch(start)
} else {
  start()
}
