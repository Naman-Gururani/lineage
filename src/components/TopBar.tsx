import { useEffect, useState } from 'react'
import { PROFILE } from '../data/content'
import { useMotion } from '../lib/motion'

export function TopBar() {
  const { scrollTo } = useMotion()
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 48)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`topbar${solid ? ' is-solid' : ''}`}>
      <a
        href="#ingress"
        className="brand"
        onClick={(e) => {
          e.preventDefault()
          scrollTo(0)
          history.replaceState(null, '', ' ')
        }}
      >
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name mono">NAMAN&nbsp;GURURANI</span>
      </a>
      <div className="topbar-right">
        <span className="status mono" aria-hidden="true">
          <i className="status-dot" />
          LIVE
        </span>
        <a className="topbar-mail mono" href={`mailto:${PROFILE.email}`}>
          Email&nbsp;<span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  )
}
