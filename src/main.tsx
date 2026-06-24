import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fonts (self-hosted via @fontsource, latin subset only — no render-blocking
// external requests, minimal CSS + font payload)
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'

import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/sections.css'

import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
