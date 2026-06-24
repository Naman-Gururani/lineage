import { COLOPHON, PROFILE } from '../data/content'

export function Footer() {
  return (
    <footer className="colophon">
      <div className="container colophon-inner">
        <div className="colophon-left">
          <p className="colophon-built">{COLOPHON.built}</p>
          <p className="colophon-type mono">Type — {COLOPHON.type}</p>
        </div>
        <div className="colophon-right mono">
          <p>
            © {COLOPHON.year} {PROFILE.name}
          </p>
          <p className="dim">{COLOPHON.note}</p>
        </div>
      </div>
    </footer>
  )
}
