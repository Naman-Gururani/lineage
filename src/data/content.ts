/* ============================================================
   NAMAN'S WORLD — content & map layout (single source of truth)
   Audit note: skill listings contain only the client-approved set;
   the in-development product is intentionally abstract and never named.
   ============================================================ */

export const PROFILE = {
  name: 'Naman Gururani',
  role: 'Software Development Engineer',
  company: 'Barclays',
  email: 'gururaninaman@gmail.com',
  github: 'https://github.com/Naman-Gururani',
  githubHandle: 'Naman-Gururani',
  linkedin: 'https://www.linkedin.com/in/naman-gururani',
  linkedinHandle: 'in/naman-gururani',
}

export type LandmarkKind =
  | 'home'
  | 'tower'
  | 'workshop'
  | 'engine'
  | 'vault'
  | 'cottage'
  | 'lighthouse'

export type Content = {
  kicker?: string
  title: string
  sub?: string
  body?: string[]
  points?: string[]
  chips?: string[]
  facts?: { k: string; v: string }[]
  groups?: { label: string; items: string[] }[]
  links?: { label: string; value: string; href: string; ext: boolean }[]
}

export type Zone = {
  id: string
  name: string // in-world landmark name
  label: string // short HUD/section label
  kind: LandmarkKind
  tx: number // tile column
  ty: number // tile row
  accent: number // hex color int
  content: Content
}

// Map is TILES_W x TILES_H tiles. Zones are spread across it for exploration.
export const TILES_W = 80
export const TILES_H = 56
export const SPAWN = { tx: 40, ty: 37 }

export const ZONES: Zone[] = [
  {
    id: 'about',
    name: 'The Cottage',
    label: 'About',
    kind: 'home',
    tx: 40,
    ty: 30,
    accent: 0xffc24b,
    content: {
      kicker: 'WHO',
      title: 'Hi, I’m Naman 👋',
      sub: 'Software Development Engineer · Barclays',
      body: [
        'I’m a backend & streaming-data engineer. I work at the layer where money becomes data — turning high-volume, real-time event streams into something you can trust.',
        'I like the unglamorous backbone: the pipelines, the guarantees, the lineage that lets a single number be believed at scale.',
      ],
      facts: [
        { k: 'Now', v: 'SDE · Barclays' },
        { k: 'Since', v: 'August 2024' },
        { k: 'Education', v: 'B.Tech CSE · SRM IST (2020–2024)' },
        { k: 'CGPA', v: '9.57 / 10' },
      ],
    },
  },
  {
    id: 'experience',
    name: 'Barclays Tower',
    label: 'Experience',
    kind: 'tower',
    tx: 17,
    ty: 15,
    accent: 0x5b9bd5,
    content: {
      kicker: 'WORK',
      title: 'Experience',
      groups: [],
      body: [
        '⭐ Software Development Engineer · Barclays · Aug 2024 — now',
        'I consume real-time streams from Apache Kafka and IBM MQ and turn raw events into something trustworthy — tokenized, classified by jurisdiction, mapped to canonical codes. I built a real-time payment lineage engine that reconstructs the full path of every payment across highly decoupled systems (each hop guarantees exactly one upstream and one downstream), running at ~750M records a day. I work spec-first, with AI spec-driven development.',
        '🛠️ DevOps Intern · Barclays · Jun — Aug 2023',
        'Automated loading of process exceptions into an analyst portal via a secured (OAuth 2.0) REST API — collapsing an 8-hour delay into real time — aggregating Teradata data with Python and KornShell.',
      ],
      chips: ['Apache Flink', 'Apache Kafka', 'Kafka Streams', 'Redis', 'DynamoDB', 'IBM MQ'],
    },
  },
  {
    id: 'skills',
    name: 'The Workshop',
    label: 'Skills',
    kind: 'workshop',
    tx: 63,
    ty: 17,
    accent: 0xff7a59,
    content: {
      kicker: 'TOOLS',
      title: 'The Workshop',
      sub: 'How I work — AI spec-driven development: a precise written spec is the contract, and AI is the force-multiplier that turns intent into correct, reviewable implementation.',
      groups: [
        { label: 'Languages & Frameworks', items: ['Java', 'Spring Boot', 'Python', 'C++', 'SQL'] },
        { label: 'Streaming & Messaging', items: ['Apache Kafka', 'Apache Flink', 'Kafka Streams', 'IBM MQ'] },
        { label: 'State & Tooling', items: ['Redis', 'DynamoDB', 'Docker', 'Linux', 'Git'] },
      ],
    },
  },
  {
    id: 'lineage',
    name: 'The Engine',
    label: 'Project',
    kind: 'engine',
    tx: 16,
    ty: 42,
    accent: 0x5eead4,
    content: {
      kicker: 'PROJECT · IN PRODUCTION',
      title: 'Real-time Payment Lineage Engine',
      sub: 'Barclays',
      body: [
        'A backend engine that reconstructs the complete lineage of every payment — every system it touched, in order — across highly decoupled services. Each hop guarantees exactly one upstream and one downstream; the engine stitches those single links into an end-to-end path, continuously, at ~750 million records a day.',
      ],
      chips: ['Apache Flink', 'Apache Kafka', 'Redis', 'DynamoDB'],
    },
  },
  {
    id: 'stealth',
    name: 'The Vault',
    label: 'Project',
    kind: 'vault',
    tx: 41,
    ty: 12,
    accent: 0xb794f6,
    content: {
      kicker: 'PROJECT · BUILDING',
      title: 'A consumer product, in development',
      sub: 'Independent',
      body: [
        'A product I’m designing and building outside of work — currently in active development, AI spec-driven from day one. Details under wraps for now. 🔒',
      ],
    },
  },
  {
    id: 'safestride',
    name: 'Safe Stride',
    label: 'Project',
    kind: 'cottage',
    tx: 66,
    ty: 44,
    accent: 0x59f3a6,
    content: {
      kicker: 'PROJECT · SHIPPED',
      title: 'Safe Stride',
      sub: 'A one-stop safety solution for the elderly',
      body: [
        'Real-time location tracking plus accelerometer-based fall detection, with automatic SOS to emergency services and a live map view.',
      ],
      chips: ['Geolocation', 'Sensors', 'Twilio', 'Leaflet'],
      links: [
        {
          label: 'GitHub',
          value: 'Naman-Gururani/Safe-Stride',
          href: 'https://github.com/Naman-Gururani/Safe-Stride',
          ext: true,
        },
      ],
    },
  },
  {
    id: 'contact',
    name: 'The Lighthouse',
    label: 'Contact',
    kind: 'lighthouse',
    tx: 44,
    ty: 49,
    accent: 0xffd95e,
    content: {
      kicker: 'SAY HELLO',
      title: 'The Lighthouse',
      body: [
        'You explored the whole island 🎉 If you’re building something where data has to be trusted end to end — or you just want to compare notes — send a signal.',
      ],
      links: [
        { label: 'Email', value: PROFILE.email, href: `mailto:${PROFILE.email}`, ext: false },
        { label: 'GitHub', value: PROFILE.githubHandle, href: PROFILE.github, ext: true },
        { label: 'LinkedIn', value: PROFILE.linkedinHandle, href: PROFILE.linkedin, ext: true },
      ],
    },
  },
]
