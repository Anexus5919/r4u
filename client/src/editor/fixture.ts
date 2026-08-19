import type { EditorResume } from './types'

/** A minimal editor document for tests. Real content, so failures read like real failures. */
export function makeResume(): EditorResume {
  return {
    id: 'r1',
    title: 'Backend Developer CV',
    status: 'draft',
    resumeType: 'technical',
    templateKey: 'foundry',
    version: 3,
    notes: '',
    personal: {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      links: [],
    },
    design: {
      accent: '',
      typeScale: 10.5,
      leading: 1.35,
      sectionSpacing: 'normal',
      margins: 20,
    },
    sections: [
      {
        _id: 's-summary',
        type: 'summary',
        title: 'Summary',
        hidden: false,
        locked: false,
        keepTogether: false,
        startOnNewPage: false,
        entries: [{ _id: 'e-summary', hidden: false, data: { text: '' } }],
      },
      {
        _id: 's-exp',
        type: 'experience',
        title: 'Work Experience',
        hidden: false,
        locked: false,
        keepTogether: false,
        startOnNewPage: false,
        entries: [
          {
            _id: 'e-halden',
            hidden: false,
            data: { role: 'Senior Backend Engineer', organisation: 'Halden Payments' },
          },
          {
            _id: 'e-corvid',
            hidden: false,
            data: { role: 'Backend Engineer', organisation: 'Corvid Messaging' },
          },
        ],
      },
      {
        _id: 's-skills',
        type: 'skills',
        title: 'Skills',
        hidden: false,
        locked: false,
        keepTogether: false,
        startOnNewPage: false,
        entries: [],
      },
    ],
  }
}
