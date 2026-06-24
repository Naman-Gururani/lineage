import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/press-start-2p/400.css'
import './styles/ui.css'

import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { WorldScene } from './scenes/WorldScene'
import { initUI } from './ui/ui'

initUI()

function start() {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#57a9dd',
    pixelArt: false,
    roundPixels: false,
    render: { antialias: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    scene: [BootScene, WorldScene],
  })
}

const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
if (fonts?.load) {
  Promise.all([fonts.load('16px Fredoka'), fonts.load('600 16px Fredoka')])
    .then(start)
    .catch(start)
} else {
  start()
}
