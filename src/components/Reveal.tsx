import { useLayoutEffect, useRef, type ElementType, type ReactNode } from 'react'
import { gsap } from '../lib/gsap'
import { useMotion } from '../lib/motion'

type RevealProps = {
  children: ReactNode
  as?: ElementType
  /** animate direct children with a stagger instead of the wrapper itself */
  stagger?: boolean
  y?: number
  delay?: number
  className?: string
  id?: string
}

/**
 * Scroll-reveal wrapper. Uses gsap.from so the *default* DOM state is the
 * visible one — if JS never runs (or motion is reduced) content is fully shown.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  stagger = false,
  y = 26,
  delay = 0,
  className,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const { reduced } = useMotion()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    const ctx = gsap.context(() => {
      const targets = stagger ? Array.from(el.children) : el
      gsap.from(targets, {
        y,
        autoAlpha: 0,
        duration: 0.9,
        delay,
        ease: 'power3.out',
        stagger: stagger ? 0.09 : 0,
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      })
    }, el)
    return () => ctx.revert()
  }, [reduced, stagger, y, delay])

  return (
    <Tag ref={ref} className={className} id={id}>
      {children}
    </Tag>
  )
}
