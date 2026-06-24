import { GameProvider } from './state/game'
import { Shell } from './Shell'

export function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  )
}
