// Toda la copy en español, con las mismas claves que site.ts (src/i18n.ts lo verifica al compilar).
// Traducción de site.ts: cada dato, cifra, nombre y fecha debe coincidir con la versión en inglés.
// Los títulos de puesto, los nombres de productos y la jerga de software (spec, pipeline, gate, merge...) quedan en inglés.
import type { site as en } from './site';

export const site: typeof en = {
  lang: 'es-MX',
  locale: 'es_MX',
  url: 'https://castrejon.mx/es/',
  paths: { home: '/es/', research: '/es/research/' },
  ogImage: '/es/og.png',
  name: 'Juan Carlos Castrejón Estrada',
  title: 'Juan Carlos Castrejón Estrada, ingeniero de software',
  description:
    'Soy Juan Carlos Castrejón Estrada, ingeniero de software en Guadalajara. Construyo sistemas multiagente y la infraestructura sobre la que corren.',
  // Saltos de línea de la imagen OG, elegidos a mano para que ninguna palabra se divida.
  ogLines: ['Ingeniero de software en Guadalajara que', 'construye sistemas multiagente y la', 'infraestructura sobre la que corren.'],
  // JSON-LD: su puesto actual, tal como aparece en el CV.
  person: { jobTitle: 'Lead Engineer', worksFor: { name: 'Netlab', url: 'https://netlab.mx' } },

  intro: {
    lede:
      'Soy ingeniero de software en Guadalajara. Construyo sistemas multiagente y la infraestructura sobre la que corren, y trabajo en todo el stack: front ends en React, servicios en Node.js y TypeScript, PostgreSQL y contenedores.',
    paragraphs: [
      'En Oracle tuve la responsabilidad completa de las pruebas de Unbounded Property Graph Queries, una nueva funcionalidad de SQL en Oracle RDBMS, desde las especificaciones de prueba hasta el sign-off que la liberó. También operé el release gate de Jenkins para cada label de RDBMS y escribí pruebas en Java con Maven y JUnit que elevaron la cobertura de pruebas hasta el 90%.',
      'Antes, en xBacked, contribuí a la infraestructura de backend de un protocolo de préstamos y construí su pipeline de CI/CD, de modo que cada merge a main llegaba a producción sin intervención manual.',
    ],
  },

  sections: { now: 'Ahora', work: 'Trabajo seleccionado', experience: 'Experiencia', contact: 'Contacto' },
  allResearch: { label: 'Toda la investigación', href: '/es/research/' },

  facts: [
    { label: 'Actualmente', value: 'Netlab', detail: 'Lead Engineer' },
    { label: 'Antes', value: 'Oracle', detail: 'Senior Staff Software Developer' },
    { label: 'Con base en', value: 'Zapopan, Jalisco', detail: 'Área metropolitana de Guadalajara · UTC−6' },
  ],
  experienceSpan: 'Desde 2017',

  now: {
    date: 'octubre de 2026',
    datetime: '2026-10',
    items: [
      'Soy Lead Engineer en Netlab, empresa que cofundé, donde construí Odoo Launchpad, una plataforma de deploy multi-tenant para instancias personalizadas del ERP Odoo. Una solicitud de cambio escrita en lenguaje sencillo se convertía en una spec redactada por un LLM. Cuando una persona aprobaba la spec, los agentes implementaban el cambio y lo llevaban a producción a través de CI y de un PR gate. Los agentes formaban un sistema de cinco roles sobre el Claude Agent SDK, orquestado como workflows durables de Temporal.',
      'Con Diego Said Anaya cofundé <a href="https://mundocognitivo.com">Mundo Cognitivo</a>, una consultora que construye agentes de IA y automatizaciones para empresas en México.',
      'Escribí y mantengo <a href="https://github.com/JCastrejonE/breakcheck">breakcheck</a>, cuyo release actual es v1.0.1.',
    ],
  },

  work: [
    {
      name: 'launchpad',
      href: 'https://github.com/JCastrejonE/launchpad',
      kind: 'Caso de estudio',
      line: 'Un caso de estudio público de Odoo Launchpad, que agentes de Claude construyeron casi por completo bajo mi dirección. Documenté los <a href="/es/research/launchpad/">hallazgos</a>.',
      stats: [
        { value: '225', caption: 'defectos registrados' },
        { value: '53%', caption: 'encontrados al ejecutar el sistema real' },
      ],
      tags: ['TypeScript', 'Claude Agent SDK', 'Temporal'],
    },
    {
      name: 'breakcheck',
      href: 'https://github.com/JCastrejonE/breakcheck',
      kind: 'Open source',
      line: 'Una herramienta de línea de comandos que demuestra que una prueba protege una línea de código: aplica una mutación, exige que la suite de pruebas falle, después restaura el código original y exige que la suite pase de nuevo.',
      tags: ['Go', 'GitHub Actions'],
    },
    {
      name: 'xBacked open source',
      href: 'https://github.com/xBacked-DAO',
      kind: 'Open source · 2021–2023',
      line: 'Fui core contributor de <a href="https://github.com/xBacked-DAO/xbacked-sdk">xbacked-sdk</a>, el SDK oficial de TypeScript del protocolo, y el colaborador principal de <a href="https://github.com/xBacked-DAO/xbacked-collector">xbacked-collector</a>, el recolector de datos del protocolo para Grafana. También contribuí a <a href="https://github.com/xBacked-DAO/algorand-wallet-select">algorand-wallet-select</a>, una integración de wallets de Algorand con varios proveedores.',
      tags: ['TypeScript', 'Reach', 'Algorand'],
    },
    {
      name: 'Investigación académica',
      href: '/es/research/#academic',
      kind: 'Investigación · UNAM, 2019–2023',
      line: 'Cuatro proyectos de la Facultad de Ciencias de la UNAM, que se volvieron a ejecutar en 2026 y se documentan aquí: el <a href="/es/research/tsp-simulated-annealing/">problema del agente viajero</a> con recocido simulado (simulated annealing), la <a href="/es/research/vertex-cover-ant-colony/">cobertura de vértices de peso mínima</a> con colonias de hormigas, el <a href="/es/research/bin-packing-reincarnation/">empaquetado en contenedores</a> (bin packing) y un <a href="/es/research/computational-genomics/">modelo de autómata celular</a> de dominios proteicos, de 2023.',
      tags: ['C++', 'Python'],
    },
  ],

  experience: [
    { company: 'Netlab', title: 'Lead Engineer', years: 'Desde 2026', note: 'Odoo Launchpad y su infraestructura de tenants' },
    { company: 'Oracle', title: 'Senior Staff Software Developer', years: '2024–2026', note: 'Punto de contacto para una nueva funcionalidad de SQL en Oracle RDBMS, desde el diseño de pruebas hasta el sign-off del release' },
    { company: 'xBacked', title: 'Core Contributor', years: '2021–2023', note: 'Infraestructura de backend y contratos inteligentes (remoto, Brisbane)' },
    { company: 'Facebook', title: 'Production Engineer Intern', years: '2020', note: 'Una migración de backend en Hack (remoto, Menlo Park)' },
    { company: 'Oracle', title: 'Software Engineer Intern', years: '2019–2020', note: 'Equipo de RDBMS, capa de datos' },
    { company: 'Quince Rooftop', title: 'Server Administrator / Full Stack Developer', years: '2017–2019', note: 'Servidores Linux y la plataforma interna' },
  ],
  education: { school: 'UNAM, Facultad de Ciencias', degree: 'Ciencias de la Computación', years: '2021' },
  ventures:
    'Además de Netlab y Mundo Cognitivo, cofundé <a href="https://sailova.com">Sailova</a>, una plataforma de reservas para la renta de yates.',
  // El PDF está en inglés; el nombre del archivo descargado no cambia.
  cv: { label: 'CV completo (PDF, en inglés)', href: '/cv.pdf', filename: 'Juan-Carlos-Castrejon-Estrada-CV.pdf' },

  contact: {
    lead: 'Si quieres hablar de un puesto o de un proyecto, escríbeme por correo.',
    email: 'jcastrejone@gmail.com',
    emailFallback: 'jcastrejone (arroba) gmail.com',
    github: { label: 'github.com/JCastrejonE', href: 'https://github.com/JCastrejonE' },
    linkedin: { label: 'linkedin.com/in/jcastrejone', href: 'https://www.linkedin.com/in/jcastrejone' },
    location: 'Zapopan, Jalisco, México',
    timezone: 'America/Mexico_City (UTC−6)',
    languages: 'Español (nativo), inglés',
  },

  labels: {
    email: 'Correo',
    github: 'GitHub',
    linkedin: 'LinkedIn',
    location: 'Ubicación',
    timezone: 'Zona horaria',
    languages: 'Idiomas',
    builtWith: 'Hecho con: ',
    contactLinks: 'Enlaces de contacto',
    facts: 'Resumen',
    cv: 'CV',
    research: 'Investigación',
    education: 'Formación',
    language: 'Idioma',
  },

  research: {
    title: 'Investigación',
    description:
      'Textos sobre mi investigación: lo que medí al construir software con agentes y mis proyectos académicos en la UNAM.',
    intro: [
      'Esta página reúne los textos de mi investigación, cada uno con sus datos y el repositorio que lo respalda.',
      'El primer grupo reporta lo que medí mientras construía software con agentes, y el segundo presenta los proyectos que completé en la Facultad de Ciencias de la UNAM.',
    ],
    groups: [
      { key: 'agents', id: 'agents', label: 'Agentes e ingeniería de software' },
      { key: 'academic', id: 'academic', label: 'Proyectos académicos' },
    ],
    labels: {
      home: 'Inicio',
      back: 'Investigación',
      repository: 'Repositorio',
      abstract: 'Resumen',
      toc: 'En esta página',
      links: 'Enlaces',
      table: 'Tabla',
    },
  },

  footer: '© 2026 Juan Carlos Castrejón Estrada',
  notFound: {
    title: 'Página no encontrada',
    text: 'La página que buscas no existe; vuelve a la <a href="/es/">página de inicio</a>.',
  },
};
