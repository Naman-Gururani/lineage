/* ============================================================
   LINEAGE — content (single source of truth)
   Audit note: skill listings contain only the client-approved
   stack; the in-development product is intentionally abstract
   and never named.
   ============================================================ */

export const STAGES = [
  { id: 'ingress', index: '01', label: 'Ingress' },
  { id: 'origin', index: '02', label: 'Origin' },
  { id: 'transform', index: '03', label: 'Transform' },
  { id: 'lineage', index: '04', label: 'Lineage' },
  { id: 'scale', index: '05', label: 'Scale' },
  { id: 'egress', index: '06', label: 'Egress' },
] as const

export type StageId = (typeof STAGES)[number]['id']

export const PROFILE = {
  name: 'Naman Gururani',
  role: 'Software Development Engineer',
  company: 'Barclays',
  since: 'Aug 2024',
  email: 'gururaninaman@gmail.com',
  github: 'https://github.com/Naman-Gururani',
  githubHandle: 'Naman-Gururani',
  linkedin: 'https://www.linkedin.com/in/naman-gururani',
  linkedinHandle: 'in/naman-gururani',
  location: 'India',
}

export const HERO = {
  kicker: 'Real-time streaming · live',
  // average throughput implied by ~750M records / 86,400 s
  throughput: 8681,
  headlineLines: ['Every record', 'has a lineage.'],
  sub: 'I build real-time systems that reconstruct where every record came from — across pipelines that don’t talk to each other.',
  cta: 'Follow the record',
}

export const ORIGIN = {
  heading: 'Where the record begins',
  body: [
    'I’m Naman — a Software Development Engineer at Barclays, working at the layer where money becomes data. Since August 2024 I’ve lived inside real-time streams: consuming high-volume events from Kafka and IBM MQ and turning raw signal into something you can trust.',
    'Tokenize it. Classify it by jurisdiction. Map it to a shared, canonical language. That unglamorous backbone — the pipelines, the guarantees, the lineage — is what lets a single number be believed at scale.',
  ],
  facts: [
    { k: 'Now', v: 'SDE · Barclays' },
    { k: 'Since', v: 'August 2024' },
    { k: 'Education', v: 'B.Tech CSE · SRM IST' },
    { k: 'CGPA', v: '9.57 / 10' },
  ],
}

export const TRANSFORM = {
  heading: 'The record is shaped',
  intro:
    'Before an event can be trusted it passes through a sequence of transforms — tokenized, classified by jurisdiction, mapped to canonical codes. These are the tools I reach for at each stage.',
  groups: [
    {
      label: 'Languages & frameworks',
      items: ['Java', 'Spring Boot'],
    },
    {
      label: 'Streaming & messaging',
      items: ['Apache Kafka', 'Apache Flink', 'Kafka Streams', 'IBM MQ'],
    },
    {
      label: 'State & storage',
      items: ['Redis', 'DynamoDB'],
    },
  ],
  method: {
    label: 'How I work',
    title: 'AI spec-driven development',
    body: 'I build spec-first: a precise written specification is the contract, and AI is the force-multiplier that turns intent into correct, reviewable implementation. Less guesswork, more guarantees.',
  },
}

export const WORK = {
  heading: 'The journey, reconstructed',
  intro:
    'Decoupled systems each promise just one thing: exactly one upstream, exactly one downstream. Stitch those single links together and the whole path appears.',
  projects: [
    {
      kind: 'flagship',
      title: 'Real-time Payment Lineage Engine',
      context: 'Barclays',
      status: 'In production',
      blurb:
        'A backend engine that reconstructs the complete lineage of every payment — every system it touched, in order — across a landscape of highly decoupled services. Each hop guarantees exactly one upstream and one downstream and nothing more; the engine stitches those single links into an end-to-end path, continuously, in real time at roughly 750 million records a day.',
      tech: ['Apache Flink', 'Apache Kafka', 'Redis', 'DynamoDB'],
    },
    {
      kind: 'stealth',
      title: 'A consumer product, in development',
      context: 'Independent',
      status: 'Building',
      blurb:
        'A product I’m designing and building outside of work — currently in active development, AI spec-driven from day one. Details under wraps for now.',
      tech: [],
    },
  ],
}

export type Stat = {
  value: number
  label: string
  kind: 'count' | 'static'
  prefix?: string
  suffix?: string
  display?: string
}

export const SCALE: { heading: string; intro: string; stats: Stat[] } = {
  heading: 'One record, multiplied',
  intro:
    'At this volume you can’t hold the whole map in memory. The lineage is reconstructed continuously — one guaranteed link at a time.',
  stats: [
    { value: 750, suffix: 'M+', label: 'records traced / day', kind: 'count' },
    { value: 8681, label: 'records / second, average', kind: 'count' },
    { value: 1, label: 'upstream → downstream per hop', kind: 'static', display: '1 : 1' },
    { value: 24, suffix: '/7', label: 'real-time, always on', kind: 'count' },
  ],
}

export const EGRESS = {
  heading: 'The record reaches its destination',
  body: 'Lineage complete. If you’re building something where data has to be trusted end to end — or you just want to compare notes — open a connection.',
  closing: 'rec ◦ committed',
}

export const COLOPHON = {
  built: 'Designed & built as a living data pipeline.',
  type: 'Space Grotesk · JetBrains Mono · Inter',
  note: 'No trackers. No cookies. Just the trace.',
  year: 2026,
}
