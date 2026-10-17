// All English copy on the site lives here, including UI labels. Every fact must come from cv.md.
// The Spanish edition is site.es.ts, with exactly the same keys (src/i18n.ts checks it at build time).

export const site = {
  lang: 'en',
  locale: 'en_US',
  url: 'https://castrejon.mx/',
  // This language's home, research index and Open Graph image.
  paths: { home: '/', research: '/research/' },
  ogImage: '/og.png',
  name: 'Juan Carlos Castrejón Estrada',
  title: 'Juan Carlos Castrejón Estrada, software engineer',
  description:
    'I’m Juan Carlos Castrejón Estrada, a software engineer in Guadalajara who builds multi-agent systems and the infrastructure under them.',
  // Line breaks for the OG image, chosen by hand so no word is hyphenated.
  ogLines: ['Software engineer in Guadalajara who', 'builds multi-agent systems and the', 'infrastructure under them.'],
  // JSON-LD: his current title, exactly as on the CV.
  person: { jobTitle: 'Lead Engineer', worksFor: { name: 'Netlab', url: 'https://netlab.mx' } },

  intro: {
    lede:
      'I’m a software engineer in Guadalajara. I build multi-agent systems and the infrastructure under them, and I work across the whole stack: React front ends, Node.js and TypeScript services, PostgreSQL, and containers.',
    paragraphs: [
      'At Oracle I held full responsibility for testing Unbounded Property Graph Queries, a new SQL feature in Oracle RDBMS, from the test specifications through the sign-off that released it. I also ran the Jenkins release gate for each RDBMS label and wrote Java tests with Maven and JUnit that raised test coverage up to 90%.',
      'Before that, at xBacked, I contributed to the backend infrastructure of a lending protocol and built its CI/CD pipeline, so every merge to main reached production without manual intervention.',
    ],
  },

  sections: { now: 'Now', work: 'Selected work', experience: 'Experience', contact: 'Contact' },
  // A quiet link to the /research index, beside the Selected work heading.
  allResearch: { label: 'All research', href: '/research/' },

  // A short summary under the intro, for readers who scan. Values are taken from cv.md.
  facts: [
    { label: 'Currently', value: 'Netlab', detail: 'Lead Engineer' },
    { label: 'Previously', value: 'Oracle', detail: 'Senior Staff Software Developer' },
    { label: 'Based in', value: 'Zapopan, Jalisco', detail: 'Guadalajara metro · UTC−6' },
  ],
  // Span of the experience timeline, shown beside its heading.
  experienceSpan: '2017–present',

  now: {
    date: 'October 2026',
    datetime: '2026-10',
    // Items are HTML strings so they can carry inline links.
    items: [
      'I’m Lead Engineer at Netlab, a company I co-founded, where I built Odoo Launchpad, a multi-tenant deployment platform for custom Odoo ERP instances. A change request written in plain language became an LLM-drafted spec. Once a person approved the spec, agents implemented the change and carried it through CI and a PR gate to production. The agents formed a five-role system on the Claude Agent SDK, orchestrated as durable Temporal workflows.',
      'With Diego Said Anaya, I co-founded <a href="https://mundocognitivo.com">Mundo Cognitivo</a>, a consultancy that builds AI agents and automations for companies in Mexico.',
      'I wrote and maintain <a href="https://github.com/JCastrejonE/breakcheck">breakcheck</a>, whose current release is v1.0.1.',
    ],
  },

  work: [
    {
      name: 'launchpad',
      href: 'https://github.com/JCastrejonE/launchpad',
      kind: 'Case study',
      line: 'A public case study of Odoo Launchpad, which Claude agents built almost entirely under my direction. I wrote up the <a href="/research/launchpad/">findings</a>.',
      stats: [
        { value: '225', caption: 'logged defects' },
        { value: '53%', caption: 'found by running the real system' },
      ],
      tags: ['TypeScript', 'Claude Agent SDK', 'Temporal'],
    },
    {
      name: 'breakcheck',
      href: 'https://github.com/JCastrejonE/breakcheck',
      kind: 'Open source',
      line: 'A command-line tool that proves a test guards a line of code: it applies one mutation, requires the suite to fail, then restores the original code and requires the suite to pass again.',
      tags: ['Go', 'GitHub Actions'],
    },
    {
      name: 'xBacked open source',
      href: 'https://github.com/xBacked-DAO',
      kind: 'Open source · 2021–2023',
      line: 'I was a core contributor to <a href="https://github.com/xBacked-DAO/xbacked-sdk">xbacked-sdk</a>, the protocol’s official TypeScript SDK, and the primary contributor to <a href="https://github.com/xBacked-DAO/xbacked-collector">xbacked-collector</a>, the protocol’s Grafana data collector. I also contributed to <a href="https://github.com/xBacked-DAO/algorand-wallet-select">algorand-wallet-select</a>, a multi-provider Algorand wallet integration.',
      tags: ['TypeScript', 'Reach', 'Algorand'],
    },
    {
      name: 'Academic research',
      href: '/research/#academic',
      kind: 'Research · UNAM, 2019–2023',
      line: 'Four projects from UNAM’s Facultad de Ciencias, re-run in 2026 and written up here: the <a href="/research/tsp-simulated-annealing/">traveling salesman problem</a> with simulated annealing, <a href="/research/vertex-cover-ant-colony/">minimum weight vertex cover</a> with ant colonies, <a href="/research/bin-packing-reincarnation/">bin packing</a>, and a 2023 <a href="/research/computational-genomics/">cellular-automaton model</a> of protein domains.',
      tags: ['C++', 'Python'],
    },
  ] as {
    name: string;
    href: string;
    kind: string;
    line: string;
    stats?: { value: string; caption: string }[];
    tags: string[];
  }[],

  experience: [
    { company: 'Netlab', title: 'Lead Engineer', years: '2026–present', note: 'Odoo Launchpad and its tenant infrastructure' },
    { company: 'Oracle', title: 'Senior Staff Software Developer', years: '2024–2026', note: 'Point of contact for a new SQL feature in Oracle RDBMS, from test design to release sign-off' },
    { company: 'xBacked', title: 'Core Contributor', years: '2021–2023', note: 'Backend infrastructure and smart contracts (remote, Brisbane)' },
    { company: 'Facebook', title: 'Production Engineer Intern', years: '2020', note: 'A backend migration in Hack (remote, Menlo Park)' },
    { company: 'Oracle', title: 'Software Engineer Intern', years: '2019–2020', note: 'RDBMS team, data layer' },
    { company: 'Quince Rooftop', title: 'Server Administrator / Full Stack Developer', years: '2017–2019', note: 'Linux servers and the internal platform' },
  ],
  education: { school: 'UNAM, Facultad de Ciencias', degree: 'Computer Science', years: '2021' },
  ventures:
    'Besides Netlab and Mundo Cognitivo, I co-founded <a href="https://sailova.com">Sailova</a>, a booking platform for yacht rental.',
  cv: { label: 'Full CV (PDF)', href: '/cv.pdf', filename: 'Juan-Carlos-Castrejon-Estrada-CV.pdf' },

  contact: {
    lead: 'If you’d like to talk about a role or a project, please write to me by email.',
    // Never rendered whole: Email.astro writes it to the HTML reversed and split, and a script reassembles it.
    email: 'jcastrejone@gmail.com',
    emailFallback: 'jcastrejone (at) gmail.com',
    github: { label: 'github.com/JCastrejonE', href: 'https://github.com/JCastrejonE' },
    linkedin: { label: 'linkedin.com/in/jcastrejone', href: 'https://www.linkedin.com/in/jcastrejone' },
    location: 'Zapopan, Jalisco, Mexico',
    timezone: 'America/Mexico_City (UTC−6)',
    languages: 'Spanish (native), English',
  },

  labels: {
    email: 'Email',
    github: 'GitHub',
    linkedin: 'LinkedIn',
    location: 'Location',
    timezone: 'Time zone',
    languages: 'Languages',
    builtWith: 'Built with: ',
    contactLinks: 'Contact links',
    facts: 'Summary',
    cv: 'CV',
    research: 'Research',
    education: 'Education',
    // The language toggle's landmark name.
    language: 'Language',
  },

  // The /research section: its index page and the labels the essay pages use.
  research: {
    title: 'Research',
    description:
      'Write-ups of my research: what I measured while building software with agents, and my academic projects at UNAM.',
    intro: [
      'This page collects the write-ups of my research, each one with its data and the repository behind it.',
      'The first group reports what I measured while I built software with agents, and the second presents the projects I completed at the Facultad de Ciencias of UNAM.',
    ],
    groups: [
      { key: 'agents', id: 'agents', label: 'Agents and software engineering' },
      { key: 'academic', id: 'academic', label: 'Academic projects' },
    ] as { key: 'agents' | 'academic'; id: string; label: string }[],
    labels: {
      home: 'Home',
      back: 'Research',
      repository: 'Repository',
      abstract: 'Abstract',
      toc: 'On this page',
      links: 'Links',
      table: 'Table',
    },
  },

  footer: '© 2026 Juan Carlos Castrejón Estrada',
  notFound: {
    title: 'Page not found',
    // HTML, for the link home.
    text: 'The page you requested doesn’t exist; please return to the <a href="/">home page</a>.',
  },
};
