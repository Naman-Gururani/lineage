import { useGame } from '../state/game'
import { PROFILE } from '../data/content'
import { sound } from '../lib/sound'

export function StartScreen() {
  const { start, revealAll } = useGame()

  return (
    <section className="start">
      <div className="container start-inner">
        <p className="pixel start-kicker">INSERT&nbsp;COIN</p>
        <h1 className="start-name">{PROFILE.name}</h1>
        <p className="start-role mono">
          {PROFILE.role} · {PROFILE.company}
        </p>
        <p className="start-blurb">{PROFILE.blurb}</p>

        <div className="start-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              sound.start()
              start()
            }}
          >
            <span className="pixel">▶&nbsp;PRESS&nbsp;START</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              sound.click()
              revealAll()
              start()
            }}
          >
            Skip the games — reveal everything →
          </button>
        </div>

        <p className="start-hint mono">3 modules locked · beat a game to open each</p>
      </div>
    </section>
  )
}
