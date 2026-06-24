import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../lib/gsap'
import { useMotion } from '../lib/motion'

type CounterProps = {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export function Counter({ value, prefix = '', suffix = '', duration = 2 }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const { reduced } = useMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (reduced) {
      el.textContent = `${prefix}${fmt(value)}${suffix}`
      return
    }

    el.textContent = `${prefix}${fmt(0)}${suffix}`
    const obj = { n: 0 }
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          n: value,
          duration,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = `${prefix}${fmt(obj.n)}${suffix}`
          },
        })
      },
    })
    return () => st.kill()
  }, [value, prefix, suffix, duration, reduced])

  return <span ref={ref} className="mono">{`${prefix}${fmt(value)}${suffix}`}</span>
}
