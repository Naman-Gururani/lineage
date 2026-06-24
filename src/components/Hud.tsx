import { useGame } from '../state/game'
import { sound } from '../lib/sound'

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  )
}

export function Hud() {
  const { access, muted, toggleMute, revealAll, start, started } = useGame()
  const pct = Math.round(access * 100)

  return (
    <header className="hud">
      <a
        className="hud-brand"
        href="#hub"
        onClick={() => {
          sound.click()
        }}
      >
        <span className="hud-mark" aria-hidden="true" />
        <span className="hud-name pixel">NAMAN.SYS</span>
      </a>

      <div className="hud-right">
        <div className="hud-access" role="img" aria-label={`System access ${pct} percent`}>
          <span className="pixel hud-access-label" aria-hidden="true">
            ACCESS
          </span>
          <span className="hud-bar" aria-hidden="true">
            <span className="hud-bar-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="mono hud-access-pct" aria-hidden="true">
            {String(pct).padStart(3, '0')}%
          </span>
        </div>

        <button
          type="button"
          className="hud-btn"
          onClick={toggleMute}
          aria-pressed={!muted}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        >
          <SpeakerIcon muted={muted} />
        </button>

        <button
          type="button"
          className="hud-btn hud-reveal pixel"
          onClick={() => {
            sound.click()
            if (!started) start()
            revealAll()
          }}
          aria-label="Reveal all content and skip the games"
        >
          REVEAL&nbsp;ALL
        </button>
      </div>
    </header>
  )
}
