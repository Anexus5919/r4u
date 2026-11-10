import type { Resume } from '../resume/schema.js'

// the one sample in the product: no screen is ever reviewed with placeholder content
export const SAMPLE_RESUME: Resume = {
  title: 'Backend Developer CV',
  resumeType: 'technical',
  templateKey: 'foundry',
  notes: '',

  design: {
    accent: '',
    typeScale: 10.5,
    leading: 1.35,
    sectionSpacing: 'normal',
    margins: 20,
  },

  personal: {
    fullName: 'Alex Mercer',
    headline: 'Backend engineer, distributed systems',
    email: 'alex.mercer@example.com',
    phone: '+44 20 7946 0182',
    location: 'Manchester, United Kingdom',
    links: [
      { label: 'GitHub', url: 'github.com/alexmercer' },
      { label: 'Website', url: 'alexmercer.dev' },
    ],
  },

  sections: [
    {
      type: 'summary',
      title: 'Summary',
      hidden: false,
      locked: false,
      keepTogether: false,
      startOnNewPage: false,
      entries: [
        {
          hidden: false,
          data: {
            text: 'Backend engineer with six years building payment and messaging systems in Go and TypeScript. Known for taking flaky services and making them boring: cut error budgets, deleted retries nobody understood, and wrote the runbooks the on-call rota actually uses.',
          },
        },
      ],
    },

    {
      type: 'experience',
      title: 'Work Experience',
      hidden: false,
      locked: false,
      keepTogether: false,
      startOnNewPage: false,
      entries: [
        {
          hidden: false,
          data: {
            role: 'Senior Backend Engineer',
            organisation: 'Halden Payments',
            location: 'Manchester',
            startDate: '2023-02',
            endDate: '',
            current: true,
            bullets: [
              'Reduced median settlement latency by 41% by replacing a nightly batch with an event-driven ledger writer.',
              'Led the migration of 38 services from a shared Postgres instance to per-service schemas, with zero customer-visible downtime.',
              'Cut on-call pages by 62% in two quarters by deleting 14 redundant retry layers and adding idempotency keys.',
              'Mentored 4 engineers through their first production incidents and wrote the incident review template the team still uses.',
            ],
          },
        },
        {
          hidden: false,
          data: {
            role: 'Backend Engineer',
            organisation: 'Corvid Messaging',
            location: 'Leeds',
            startDate: '2020-08',
            endDate: '2023-01',
            current: false,
            bullets: [
              'Built the fan-out service delivering 9 million notifications per day at a p99 of 240 ms.',
              'Introduced contract testing across 11 services, which removed roughly 3 integration failures per week.',
              'Automated the release pipeline, taking deploys from 45 minutes of manual steps to 6 minutes unattended.',
            ],
          },
        },
      ],
    },

    {
      type: 'projects',
      title: 'Projects',
      hidden: false,
      locked: false,
      keepTogether: false,
      startOnNewPage: false,
      entries: [
        {
          hidden: false,
          data: {
            name: 'Tideline',
            url: 'github.com/alexmercer/tideline',
            startDate: '2024-03',
            endDate: '',
            current: true,
            stack: ['Go', 'SQLite', 'NATS'],
            bullets: [
              'Wrote an append-only event store used by 3 open source projects, with 1,400 stars and 22 contributors.',
            ],
          },
        },
      ],
    },

    {
      type: 'education',
      title: 'Education',
      hidden: false,
      locked: false,
      keepTogether: false,
      startOnNewPage: false,
      entries: [
        {
          hidden: false,
          data: {
            degree: 'BSc Computer Science, First Class Honours',
            organisation: 'University of Sheffield',
            location: 'Sheffield',
            startDate: '2016-09',
            endDate: '2019-07',
            current: false,
            grade: '',
            coursework: [],
          },
        },
      ],
    },

    {
      type: 'skills',
      title: 'Skills',
      hidden: false,
      locked: false,
      keepTogether: false,
      startOnNewPage: false,
      entries: [
        {
          hidden: false,
          data: { group: 'Languages', items: ['Go', 'TypeScript', 'Python', 'SQL'] },
        },
        {
          hidden: false,
          data: {
            group: 'Infrastructure',
            items: ['PostgreSQL', 'Redis', 'Kafka', 'Docker', 'Terraform'],
          },
        },
        {
          hidden: false,
          data: {
            group: 'Practices',
            items: ['Observability', 'Contract testing', 'Incident response'],
          },
        },
      ],
    },

    {
      type: 'certifications',
      title: 'Certifications',
      hidden: true,
      locked: false,
      keepTogether: false,
      startOnNewPage: false,
      entries: [
        {
          hidden: false,
          data: {
            name: 'Certified Kubernetes Administrator',
            issuer: 'Cloud Native Computing Foundation',
            startDate: '2022-05',
            endDate: '2025-05',
            url: '',
          },
        },
      ],
    },
  ],
}

// hidden on purpose, so every render exercises the hide-without-delete path of FR 4.3
