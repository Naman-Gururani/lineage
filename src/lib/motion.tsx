import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './gsap'

type MotionValue = {
  reduced: boolean
  scrollTo: (target: string | number, opts?: { offset?: number }) => void
}

const MotionContext = createContext<MotionValue>({
  reduced: false,
  scrollTo: () => {},
})

export const useMotion = () => useContext(MotionContext)

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(prefersReduced)
  const lenisRef = useRef<Lenis | null>(null)

  // React to changes in the user's motion preference.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Smooth scroll (Lenis) wired into the GSAP ticker + ScrollTrigger.
  useEffect(() => {
    if (reduced) return

    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const onTick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(onTick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reduced])

  const scrollTo = useCallback<MotionValue['scrollTo']>(
    (target, opts) => {
      const offset = opts?.offset ?? 0
      if (lenisRef.current) {
        lenisRef.current.scrollTo(target, { offset, duration: 1.2 })
      } else if (typeof target === 'string') {
        const el = document.querySelector(target)
        el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
      } else {
        window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' })
      }
    },
    [reduced],
  )

  return (
    <MotionContext.Provider value={{ reduced, scrollTo }}>
      {children}
    </MotionContext.Provider>
  )
}
