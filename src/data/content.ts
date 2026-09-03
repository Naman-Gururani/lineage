/* ============================================================
   NAMAN'S WORLD — content & map layout (single source of truth)
   Audit note: skill listings contain only the client-approved set;
   the in-development product is intentionally abstract and never named.
   ============================================================ */

export const PROFILE = {
  name: 'Naman Gururani',
  role: 'Software Development Engineer',
  company: 'Barclays',
  location: 'India',
  email: 'gururaninaman@gmail.com',
  github: 'https://github.com/Naman-Gururani',
  githubHandle: 'Naman-Gururani',
  linkedin: 'https://www.linkedin.com/in/naman-gururani',
  linkedinHandle: 'in/naman-gururani',
}

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
  name: string // the attraction this chapter is handed over at
  label: string // short HUD/section label
  /**
   * The name on the prize box, for the chapters won off the claw machine's
   * shelf. All three are labelled "Project" and all three come out of the same
   * tent, so this is the only thing that tells them apart while they are still
   * locked: the claw cabinet paints it on the box, and the Journal's prize
   * shelf repeats it on the row. Only the prize chapters carry one.
   */
  short?: string
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
    name: 'Ticket Booth',
    label: 'About',
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
        { k: 'CGPA', v: '9.63 / 10' },
      ],
    },
  },
  {
    id: 'experience',
    name: 'Career Coaster',
    label: 'Experience',
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
    id: 'education',
    name: 'Career Coaster',
    label: 'Education',
    tx: 57,
    ty: 26,
    accent: 0x7ec8ff,
    content: {
      kicker: 'STUDY',
      title: 'SRM Institute of Science and Technology',
      sub: 'B.Tech, Computer Science & Engineering · 2020 – 2024',
      facts: [
        { k: 'Degree', v: 'B.Tech CSE' },
        { k: 'Years', v: '2020 – 2024' },
        { k: 'CGPA', v: '9.63 / 10' },
      ],
      body: ['Where systems stopped being homework and started being fun.'],
    },
  },
  {
    id: 'skills',
    name: 'Word Forge',
    label: 'Skills',
    tx: 63,
    ty: 17,
    accent: 0xff7a59,
    content: {
      kicker: 'TOOLS',
      title: 'The Word Forge',
      sub: 'How I work — AI writes most of my code now. Knowing what good software looks like is still the job.',
      body: [
        'My recent work has been built with Claude Code rather than typed by hand, and it still takes weeks, not hours, because serious software development was never mostly typing. The unknowns arrive as you build, test and get feedback.',
        'My time goes to the higher level: the approach, the architecture, the design decisions. I challenge what the tool proposes, debate its choices and push for the simpler, more robust answer. That is the engineering.',
        'You may not need to know every API by heart any more, but you still need separation of concerns, coupling and cohesion, data modelling, API design, error handling, security, performance and testing — enough to ask whether that extra layer is necessary, whether there is a simpler way, and whether it will still be maintainable in six months. AI can write the code. You still have to know what good software looks like.',
      ],
      groups: [
        { label: 'Languages & Frameworks', items: ['Java', 'Spring Boot', 'Python', 'C++', 'SQL'] },
        { label: 'Streaming & Messaging', items: ['Apache Kafka', 'Apache Flink', 'Kafka Streams', 'IBM MQ'] },
        { label: 'State & Tooling', items: ['Redis', 'DynamoDB', 'Docker', 'Linux', 'Git'] },
      ],
    },
  },
  {
    id: 'lineage',
    name: 'Prize Tent',
    label: 'Project',
    short: 'Lineage Engine',
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
    name: 'Prize Tent',
    label: 'Project',
    short: '???', // the product is unnamed here exactly as it is everywhere else
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
    name: 'Prize Tent',
    label: 'Project',
    short: 'Safe Stride',
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
    name: 'Guestbook',
    label: 'Contact',
    tx: 44,
    ty: 49,
    accent: 0xffd95e,
    content: {
      kicker: 'SAY HELLO',
      title: 'The Guestbook',
      body: [
        'You saw the whole fair 🎉 If you’re building something where data has to be trusted end to end — or you just want to compare notes — send a signal.',
        'Looking for a backend, data or Java engineer? Say hello. I’m just as happy in full-stack or spec-driven work, or something we haven’t named yet.',
      ],
      facts: [{ k: 'Open to', v: 'Backend · Data · Java · Full-stack · Spec-driven dev' }],
      links: [
        { label: 'Email', value: PROFILE.email, href: `mailto:${PROFILE.email}`, ext: false },
        { label: 'GitHub', value: PROFILE.githubHandle, href: PROFILE.github, ext: true },
        { label: 'LinkedIn', value: PROFILE.linkedinHandle, href: PROFILE.linkedin, ext: true },
      ],
    },
  },
]
