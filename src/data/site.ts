// All copy on the site lives here, including UI labels. Every fact must come from cv.md.
// To add a Spanish version later, copy this object to site.es.ts and translate the strings.

export const site = {
  lang: 'en',
  locale: 'en_US',
  url: 'https://castrejon.mx/',
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
      'At Oracle I held full responsibility for testing Unbounded Property Graph Queries, a new SQL feature in Oracle RDBMS, from the test specifications through the sign-off that released it. I also proposed a Codex-based tool and helped the team build it; it automated up to 85% of a Java test migration. I paired with the team on it until they could run it without me.',
      'Before that, at xBacked, I owned the backend infrastructure of a lending protocol and built its CI/CD pipeline, so every merge to main reached production without manual intervention.',
    ],
  },

  sections: { now: 'Now', work: 'Selected work', experience: 'Experience', contact: 'Contact' },

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
      line: 'A public case study of Odoo Launchpad, which Claude agents built almost entirely under my direction.',
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
      name: 'Heuristic solvers',
      href: 'https://github.com/JCastrejonE?tab=repositories',
      kind: 'Research · UNAM, 2019',
      line: 'Command-line solvers for the <a href="https://github.com/JCastrejonE/TSP_SimulatedAnnealing">traveling salesman problem</a> with simulated annealing, <a href="https://github.com/JCastrejonE/MWVCP_AntColony">minimum weight vertex cover</a> with ant colonies, and <a href="https://github.com/JCastrejonE/BPP_Reincarnation">bin packing</a>.',
      tags: ['C++', 'Meson'],
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
    education: 'Education',
  },

  footer: '© 2026 Juan Carlos Castrejón Estrada',
  notFound: {
    title: 'Page not found',
    // HTML, for the link home.
    text: 'The page you requested doesn’t exist; please return to the <a href="/">home page</a>.',
  },
};
