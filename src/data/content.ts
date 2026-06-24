/* ============================================================
   NAMAN.SYS — content (single source of truth)
   Audit note: skill listings contain only the client-approved
   set; the in-development product is intentionally abstract and
   never named.
   ============================================================ */

export const PROFILE = {
  name: 'Naman Gururani',
  role: 'Software Development Engineer',
  company: 'Barclays',
  since: 'Aug 2024',
  location: 'India',
  tagline: 'I build real-time systems that move money.',
  blurb:
    'Backend & streaming-data engineer at Barclays. I turn high-volume, real-time event streams into something you can trust — at the scale where a single number has to be believed. This portfolio is locked: beat the games to unlock the rest.',
  email: 'gururaninaman@gmail.com',
  github: 'https://github.com/Naman-Gururani',
  githubHandle: 'Naman-Gururani',
  linkedin: 'https://www.linkedin.com/in/naman-gururani',
  linkedinHandle: 'in/naman-gururani',
  education: {
    degree: 'B.Tech, Computer Science & Engineering',
    school: 'SRM Institute of Science and Technology',
    span: '2020 — 2024',
    cgpa: '9.57 / 10',
  },
}

export type ModuleId = 'experience' | 'skills' | 'projects' | 'contact'
export type GameId = 'route' | 'sort' | 'decrypt'

export const MODULES: {
  id: ModuleId
  code: string
  label: string
  game: GameId | null
  teaser: string
  challenge: string
}[] = [
  {
    id: 'experience',
    code: 'EXP',
    label: 'Experience',
    game: 'route',
    teaser: 'Where I work and what I’ve shipped.',
    challenge: 'ROUTE — connect the source to the sink',
  },
  {
    id: 'skills',
    code: 'SKL',
    label: 'Skills',
    game: 'sort',
    teaser: 'The stack I reach for.',
    challenge: 'SORT — classify the stream in real time',
  },
  {
    id: 'projects',
    code: 'PRJ',
    label: 'Projects',
    game: 'decrypt',
    teaser: 'Things I’ve built.',
    challenge: 'DECRYPT — crack the cipher',
  },
  {
    id: 'contact',
    code: 'OUT',
    label: 'Contact',
    game: null,
    teaser: 'Reach me — unlocks at full clearance.',
    challenge: 'Unlock every module',
  },
]

export const EXPERIENCE = [
  {
    role: 'Software Development Engineer',
    org: 'Barclays',
    span: 'Aug 2024 — Present',
    now: true,
    points: [
      'Work at the layer where money becomes data — consuming real-time streams from Apache Kafka and IBM MQ and turning raw, high-volume events into something trustworthy.',
      'Tokenize, classify by jurisdiction, and map events to canonical codes across the pipeline.',
      'Built a real-time payment lineage engine that reconstructs the full path of every payment across highly decoupled systems — each hop guaranteeing exactly one upstream and one downstream — running at roughly 750M records a day.',
      'Work spec-first with AI spec-driven development.',
    ],
    tags: ['Apache Flink', 'Apache Kafka', 'Kafka Streams', 'Redis', 'DynamoDB', 'IBM MQ'],
  },
  {
    role: 'DevOps Intern',
    org: 'Barclays',
    span: 'Jun — Aug 2023',
    now: false,
    points: [
      'Automated loading of process exceptions into an analyst portal via a REST API — collapsing an 8-hour delay into real time.',
      'Aggregated exception data from Teradata with Python and KornShell into a clean, portal-ready format.',
      'Secured the integration with OAuth 2.0 for seamless, authenticated request/response.',
    ],
    tags: ['Python', 'KornShell', 'Teradata', 'OAuth 2.0', 'REST'],
  },
]

export type SkillCat = 'lang' | 'stream' | 'state'

export const SKILL_CATS: { key: SkillCat; label: string; short: string }[] = [
  { key: 'lang', label: 'Languages & Frameworks', short: 'CORE' },
  { key: 'stream', label: 'Streaming & Messaging', short: 'STREAM' },
  { key: 'state', label: 'State & Tooling', short: 'STATE' },
]

export const SKILLS: { name: string; cat: SkillCat }[] = [
  { name: 'Java', cat: 'lang' },
  { name: 'Spring Boot', cat: 'lang' },
  { name: 'Python', cat: 'lang' },
  { name: 'C++', cat: 'lang' },
  { name: 'SQL', cat: 'lang' },
  { name: 'Apache Kafka', cat: 'stream' },
  { name: 'Apache Flink', cat: 'stream' },
  { name: 'Kafka Streams', cat: 'stream' },
  { name: 'IBM MQ', cat: 'stream' },
  { name: 'Redis', cat: 'state' },
  { name: 'DynamoDB', cat: 'state' },
  { name: 'Docker', cat: 'state' },
  { name: 'Linux', cat: 'state' },
  { name: 'Git', cat: 'state' },
]

export const SKILL_METHOD = {
  title: 'AI spec-driven development',
  body: 'I build spec-first: a precise written specification is the contract, and AI is the force-multiplier that turns intent into correct, reviewable implementation.',
}

export const PROJECTS = [
  {
    title: 'Real-time Payment Lineage Engine',
    context: 'Barclays',
    status: 'In production',
    accent: 'cyan',
    blurb:
      'A backend engine that reconstructs the complete lineage of every payment — every system it touched, in order — across highly decoupled services. Each hop guarantees exactly one upstream and one downstream; the engine stitches those single links into an end-to-end path, continuously, at ~750M records a day.',
    tags: ['Apache Flink', 'Apache Kafka', 'Redis', 'DynamoDB'],
    link: null,
  },
  {
    title: 'A consumer product, in development',
    context: 'Independent',
    status: 'Building',
    accent: 'gold',
    blurb:
      'A product I’m designing and building outside of work — currently in active development, AI spec-driven from day one. Details under wraps for now.',
    tags: [],
    link: null,
  },
  {
    title: 'Safe Stride',
    context: 'Personal',
    status: 'Shipped',
    accent: 'coral',
    blurb:
      'A one-stop safety solution for the elderly: real-time location tracking plus accelerometer-based fall detection, with automatic SOS to emergency services and a live map view.',
    tags: ['Geolocation', 'Sensors', 'Twilio', 'Leaflet'],
    link: 'https://github.com/Naman-Gururani/Safe-Stride',
  },
]

export const CONTACT = {
  win: 'ACCESS GRANTED',
  message:
    'Full clearance. You traced the whole system. If you’re building something where data has to be trusted end to end — or you just want to compare notes — open a connection.',
  links: [
    { label: 'Email', value: PROFILE.email, href: `mailto:${PROFILE.email}`, ext: false },
    { label: 'GitHub', value: PROFILE.githubHandle, href: PROFILE.github, ext: true },
    { label: 'LinkedIn', value: PROFILE.linkedinHandle, href: PROFILE.linkedin, ext: true },
  ],
}

// DECRYPT game: the plaintext the player decodes (Caesar-shifted at runtime).
export const DECRYPT = {
  plain: 'EXACTLY ONCE',
  hint: 'streaming’s favourite delivery guarantee',
}

export const COLOPHON = {
  built: 'Built as a small arcade. No trackers, no cookies — just the games.',
  tech: 'Vite · TypeScript · GSAP · Canvas · Web Audio',
  year: 2026,
}
