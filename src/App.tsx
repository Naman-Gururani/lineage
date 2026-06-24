import { useMemo } from 'react'
import { STAGES } from './data/content'
import { MotionProvider } from './lib/motion'
import { useActiveSection } from './lib/useActiveSection'

import { BackgroundCanvas } from './components/BackgroundCanvas'
import { LineageThread } from './components/LineageThread'
import { TopBar } from './components/TopBar'
import { StageRail } from './components/StageRail'
import { TelemetryHud } from './components/TelemetryHud'

import { Ingress } from './sections/Ingress'
import { Origin } from './sections/Origin'
import { Transform } from './sections/Transform'
import { Work } from './sections/Work'
import { Scale } from './sections/Scale'
import { Egress } from './sections/Egress'
import { Footer } from './sections/Footer'

function Experience() {
  const ids = useMemo<string[]>(() => STAGES.map((s) => s.id), [])
  const active = useActiveSection(ids)

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <BackgroundCanvas />
      <TopBar />
      <StageRail active={active} />
      <TelemetryHud />

      <div className="app">
        <LineageThread />
        <main id="main">
          <Ingress />
          <Origin />
          <Transform />
          <Work />
          <Scale />
          <Egress />
        </main>
        <Footer />
      </div>
    </>
  )
}

export function App() {
  return (
    <MotionProvider>
      <Experience />
    </MotionProvider>
  )
}
