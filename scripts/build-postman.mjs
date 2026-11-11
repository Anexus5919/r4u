// generates docs/r4u.postman_collection.json and its environment: node scripts/build-postman.mjs
import { writeFileSync } from 'node:fs'

const JSON_HEADERS = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'X-Requested-With', value: 'r4u' },
]

function request(name, method, path, { token, body, tests = [], pre = [] } = {}) {
  const headers = [...JSON_HEADERS]
  if (token) headers.push({ key: 'Authorization', value: `Bearer {{${token}}}` })
  const event = [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }]
  if (pre.length)
    event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } })
  return {
    name,
    event,
    request: {
      method,
      header: headers,
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ['{{baseUrl}}'],
        path: path.replace(/^\//, '').split('?')[0].split('/'),
        ...(path.includes('?')
          ? {
              query: path
                .split('?')[1]
                .split('&')
                .map((kv) => ({ key: kv.split('=')[0], value: kv.split('=')[1] })),
            }
          : {}),
      },
      ...(body
        ? {
            body: {
              mode: 'raw',
              raw: JSON.stringify(body, null, 2),
              options: { raw: { language: 'json' } },
            },
          }
        : {}),
    },
  }
}

const status = (code) => [
  `pm.test('status is ${code}', () => pm.response.to.have.status(${code}));`,
]
const code = (value) => [
  `pm.test('error code is ${value}', () => pm.expect(pm.response.json().error.code).to.eql('${value}'));`,
]
const save = (variable, expr) => [`pm.environment.set('${variable}', ${expr});`]

const login = (name, email, variable) =>
  request(name, 'POST', '/api/auth/login', {
    body: { email, password: '{{demoPassword}}' },
    tests: [
      ...status(200),
      ...save(variable, 'pm.response.json().data.accessToken'),
      ...save(`${variable}UserId`, 'pm.response.json().data.user.id'),
    ],
  })

const folders = [
  {
    name: '01 Health',
    item: [
      request('Health reports a connected database', 'GET', '/api/health', {
        tests: [
          ...status(200),
          "pm.test('db is connected', () => pm.expect(pm.response.json().data.db).to.eql(1));",
        ],
      }),
    ],
  },
  {
    name: '02 Auth',
    item: [
      login('Login as the demo user', '{{userEmail}}', 'userToken'),
      login('Login as the demo reviewer', '{{reviewerEmail}}', 'reviewerToken'),
      login('Login as the admin', '{{adminEmail}}', 'adminToken'),
      request('Register: invalid email is 422', 'POST', '/api/auth/register', {
        body: { name: 'Bad Email', email: 'not-an-email', password: 'CorrectHorse7Battery' },
        tests: [...status(422), ...code('VALIDATION_FAILED')],
      }),
      request('Register: weak password is 422', 'POST', '/api/auth/register', {
        body: { name: 'Weak', email: 'weak@example.com', password: 'short' },
        tests: [...status(422)],
      }),
      request('Register a fresh account', 'POST', '/api/auth/register', {
        pre: ["pm.environment.set('freshEmail', `postman${Date.now()}@example.com`);"],
        body: { name: 'Postman Tester', email: '{{freshEmail}}', password: 'CorrectHorse7Battery' },
        tests: [
          ...status(201),
          "pm.test('never returns a password hash', () => pm.expect(pm.response.text()).to.not.include('passwordHash'));",
          ...save('freshToken', 'pm.response.json().data.accessToken'),
        ],
      }),
      request('Register: duplicate email is 409', 'POST', '/api/auth/register', {
        body: { name: 'Again', email: '{{freshEmail}}', password: 'CorrectHorse7Battery' },
        tests: [...status(409), ...code('EMAIL_IN_USE')],
      }),
      request('Me without a token is 401', 'GET', '/api/users/me', {
        tests: [...status(401), ...code('TOKEN_MISSING')],
      }),
      request('Me with a token', 'GET', '/api/users/me', {
        token: 'userToken',
        tests: [
          ...status(200),
          "pm.test('is the demo user', () => pm.expect(pm.response.json().data.user.email).to.eql(pm.environment.get('userEmail')));",
        ],
      }),
      request('Forgot password always answers 200', 'POST', '/api/auth/forgot-password', {
        body: { email: 'nobody-at-all@example.com' },
        tests: [...status(200)],
      }),
    ],
  },
  {
    name: '03 Resumes',
    item: [
      request('Create a resume', 'POST', '/api/resumes', {
        token: 'userToken',
        body: { title: 'Postman CV', resumeType: 'technical', templateKey: 'foundry-compact' },
        tests: [
          ...status(201),
          ...save('resumeId', 'pm.response.json().data.resume.id'),
          ...save('resumeVersion', 'pm.response.json().data.resume.version'),
          "pm.test('preset applied', () => pm.expect(pm.response.json().data.resume.design.sectionSpacing).to.eql('compact'));",
        ],
      }),
      request('Create: missing title is 422', 'POST', '/api/resumes', {
        token: 'userToken',
        body: { resumeType: 'technical' },
        tests: [...status(422)],
      }),
      request(
        'List with search, filter and sort',
        'GET',
        '/api/resumes?q=Postman&status=draft&sort=title&limit=5',
        {
          token: 'userToken',
          tests: [
            ...status(200),
            "pm.test('summaries carry no content', () => pm.expect(pm.response.json().data.resumes[0]).to.not.have.property('sections'));",
          ],
        }
      ),
      request('Read one resume', 'GET', '/api/resumes/{{resumeId}}', {
        token: 'userToken',
        tests: [...status(200)],
      }),
      request('Read as another user is 404, never 403', 'GET', '/api/resumes/{{resumeId}}', {
        token: 'reviewerToken',
        tests: [...status(404), ...code('NOT_FOUND')],
      }),
      request('Autosave a design change', 'PATCH', '/api/resumes/{{resumeId}}', {
        token: 'userToken',
        body: {
          version: '{{resumeVersion}}',
          ops: [{ op: 'setDesign', field: 'typeScale', value: 11 }],
        },
        pre: [
          "const body = JSON.parse(pm.request.body.raw); body.version = Number(pm.environment.get('resumeVersion')); pm.request.body.raw = JSON.stringify(body);",
        ],
        tests: [...status(200)],
      }),
      request('Autosave with a stale version is 409', 'PATCH', '/api/resumes/{{resumeId}}', {
        token: 'userToken',
        body: { version: 0, ops: [{ op: 'setDesign', field: 'typeScale', value: 10 }] },
        tests: [...status(409), ...code('VERSION_CONFLICT')],
      }),
      request('Rename', 'PATCH', '/api/resumes/{{resumeId}}/title', {
        token: 'userToken',
        body: { title: 'Postman CV, renamed' },
        tests: [...status(200)],
      }),
      request('Duplicate', 'POST', '/api/resumes/{{resumeId}}/duplicate', {
        token: 'userToken',
        body: {},
        tests: [...status(201), ...save('duplicateId', 'pm.response.json().data.resume.id')],
      }),
      request('Snapshot a version', 'POST', '/api/resumes/{{resumeId}}/versions', {
        token: 'userToken',
        body: { label: 'Before Postman edits' },
        tests: [...status(201)],
      }),
      request('List versions', 'GET', '/api/resumes/{{resumeId}}/versions', {
        token: 'userToken',
        tests: [...status(200)],
      }),
      request('Export JSON Resume', 'GET', '/api/resumes/{{resumeId}}/export.json', {
        token: 'userToken',
        tests: [
          ...status(200),
          "pm.test('has basics', () => pm.expect(pm.response.json()).to.have.property('basics'));",
        ],
      }),
      request('ATS score, format only', 'POST', '/api/resumes/{{resumeId}}/ats', {
        token: 'userToken',
        body: {},
        tests: [
          ...status(200),
          "pm.test('format only', () => pm.expect(pm.response.json().data.mode).to.eql('format_only'));",
          "pm.test('five dimensions', () => pm.expect(pm.response.json().data.dimensions.length).to.eql(5));",
        ],
      }),
      request('ATS score against a pasted posting', 'POST', '/api/resumes/{{resumeId}}/ats', {
        token: 'userToken',
        body: {
          jobDescription:
            'Backend Engineer\nRequirements:\n- TypeScript, PostgreSQL, Kafka and Kubernetes\n- 3+ years of experience',
        },
        tests: [
          ...status(200),
          "pm.test('matched to the job', () => pm.expect(pm.response.json().data.mode).to.eql('full'));",
          "pm.test('keyword report', () => pm.expect(pm.response.json().data.keywords).to.have.property('missing'));",
        ],
      }),
      request('ATS history, ids and points only', 'GET', '/api/resumes/{{resumeId}}/ats', {
        token: 'userToken',
        tests: [
          ...status(200),
          "pm.test('two scores kept', () => pm.expect(pm.response.json().data.history.length).to.be.at.least(2));",
        ],
      }),
      request('Import JSON Resume', 'POST', '/api/resumes/import', {
        token: 'userToken',
        body: {
          title: 'Imported by Postman',
          document: {
            basics: { name: 'Postman Person', summary: 'Imported through the API.' },
            work: [{ name: 'Acme', position: 'Engineer', highlights: ['Cut costs by 20%.'] }],
          },
        },
        tests: [...status(201)],
      }),
      request('Delete the duplicate', 'DELETE', '/api/resumes/{{duplicateId}}', {
        token: 'userToken',
        tests: [...status(204)],
      }),
    ],
  },
  {
    name: '04 Templates and sharing',
    item: [
      request('Public template gallery', 'GET', '/api/templates', {
        tests: [
          ...status(200),
          "pm.test('has templates', () => pm.expect(pm.response.json().data.templates.length).to.be.above(7));",
        ],
      }),
      request('Create a share link', 'POST', '/api/resumes/{{resumeId}}/share', {
        token: 'userToken',
        body: { redact: { phone: true } },
        tests: [
          ...status(201),
          ...save('shareToken', 'pm.response.json().data.token'),
          ...save('shareId', 'pm.response.json().data.link.id'),
        ],
      }),
      request('Open the public page without a login', 'GET', '/api/public/r/{{shareToken}}', {
        tests: [
          ...status(200),
          "pm.test('noindex header', () => pm.expect(pm.response.headers.get('X-Robots-Tag')).to.eql('noindex, nofollow'));",
          "pm.test('phone redacted', () => pm.expect(pm.response.json().data.resume.personal.phone).to.eql(''));",
        ],
      }),
      request('Record a download', 'POST', '/api/public/r/{{shareToken}}/download', {
        tests: [...status(200)],
      }),
      request('Analytics for the owner', 'GET', '/api/share/{{shareId}}/analytics', {
        token: 'userToken',
        tests: [
          ...status(200),
          "pm.test('thirty days', () => pm.expect(pm.response.json().data.daily.length).to.eql(30));",
        ],
      }),
      request('Another user cannot change the link', 'PATCH', '/api/share/{{shareId}}', {
        token: 'reviewerToken',
        body: { enabled: false },
        tests: [...status(404)],
      }),
      request('Turn the link off', 'PATCH', '/api/share/{{shareId}}', {
        token: 'userToken',
        body: { enabled: false },
        tests: [...status(200)],
      }),
      request('A disabled link is 410', 'GET', '/api/public/r/{{shareToken}}', {
        tests: [...status(410), ...code('SHARE_LINK_DISABLED')],
      }),
      request('Delete the link', 'DELETE', '/api/share/{{shareId}}', {
        token: 'userToken',
        tests: [...status(204)],
      }),
    ],
  },
  {
    name: '05 Reviews and notifications',
    item: [
      request('Reviewer directory', 'GET', '/api/users/reviewers', {
        token: 'userToken',
        tests: [
          ...status(200),
          "pm.test('no emails exposed', () => pm.expect(pm.response.text()).to.not.include('@r4u.dev'));",
        ],
      }),
      request('Request a review', 'POST', '/api/reviews', {
        token: 'userToken',
        pre: [
          "pm.request.body.raw = JSON.stringify({ resumeId: pm.environment.get('resumeId'), reviewerId: pm.environment.get('reviewerTokenUserId'), message: 'Postman review request' });",
        ],
        body: {},
        tests: [...status(201), ...save('reviewId', 'pm.response.json().data.review.id')],
      }),
      request(
        'The owner cannot accept their own request',
        'PATCH',
        '/api/reviews/{{reviewId}}/respond',
        { token: 'userToken', body: { accept: true }, tests: [...status(403)] }
      ),
      request('The reviewer accepts', 'PATCH', '/api/reviews/{{reviewId}}/respond', {
        token: 'reviewerToken',
        body: { accept: true },
        tests: [...status(200)],
      }),
      request('The reviewer reads the resume', 'GET', '/api/reviews/{{reviewId}}/resume', {
        token: 'reviewerToken',
        tests: [...status(200)],
      }),
      request('Comments, initial load', 'GET', '/api/reviews/{{reviewId}}/comments', {
        token: 'reviewerToken',
        tests: [...status(200)],
      }),
      request('Messages, cursor page', 'GET', '/api/reviews/{{reviewId}}/messages', {
        token: 'userToken',
        tests: [...status(200)],
      }),
      request(
        'The owner sends it back for re-review',
        'PATCH',
        '/api/reviews/{{reviewId}}/resubmit',
        {
          token: 'userToken',
          body: { note: 'Moved the strongest result to the top.' },
          tests: [
            ...status(200),
            "pm.test('round two', () => pm.expect(pm.response.json().data.review.round).to.eql(2));",
          ],
        }
      ),
      request('A reviewer cannot resubmit', 'PATCH', '/api/reviews/{{reviewId}}/resubmit', {
        token: 'reviewerToken',
        body: {},
        tests: [...status(403)],
      }),
      request('The reviewer completes it', 'PATCH', '/api/reviews/{{reviewId}}/complete', {
        token: 'reviewerToken',
        body: { summary: 'Strong and clear.' },
        tests: [
          ...status(200),
          "pm.test('completed', () => pm.expect(pm.response.json().data.review.status).to.eql('completed'));",
        ],
      }),
      request('The owner rates the review', 'PATCH', '/api/reviews/{{reviewId}}/rating', {
        token: 'userToken',
        body: { rating: 5, note: 'Specific and quick.' },
        tests: [
          ...status(200),
          "pm.test('rated', () => pm.expect(pm.response.json().data.review.rating).to.eql(5));",
        ],
      }),
      request('A rating outside 1 to 5 is refused', 'PATCH', '/api/reviews/{{reviewId}}/rating', {
        token: 'userToken',
        body: { rating: 9 },
        tests: [...status(422), ...code('VALIDATION_FAILED')],
      }),
      request('Notifications for the owner', 'GET', '/api/notifications?filter=review', {
        token: 'userToken',
        tests: [...status(200)],
      }),
      request('Mark all read', 'PATCH', '/api/notifications/read-all', {
        token: 'userToken',
        tests: [
          ...status(200),
          "pm.test('none unread', () => pm.expect(pm.response.json().data.unread).to.eql(0));",
        ],
      }),
    ],
  },
  {
    name: '06 Admin',
    item: [
      request('Stats', 'GET', '/api/admin/stats', { token: 'adminToken', tests: [...status(200)] }),
      request('A user is refused the admin API with 403', 'GET', '/api/admin/stats', {
        token: 'userToken',
        tests: [...status(403), ...code('FORBIDDEN_ROLE')],
      }),
      request(
        'Admin reading resume content is 403 ADMIN_CONTENT_FORBIDDEN',
        'GET',
        '/api/resumes/{{resumeId}}',
        { token: 'adminToken', tests: [...status(403), ...code('ADMIN_CONTENT_FORBIDDEN')] }
      ),
      request('Admin is refused a review', 'GET', '/api/reviews/{{reviewId}}', {
        token: 'adminToken',
        tests: [...status(403)],
      }),
      request('Users, searched and paged', 'GET', '/api/admin/users?q=r4u.dev&page=1&limit=5', {
        token: 'adminToken',
        tests: [
          ...status(200),
          "pm.test('paged', () => pm.expect(pm.response.json().meta.limit).to.eql(5));",
        ],
      }),
      request('Templates', 'GET', '/api/admin/templates', {
        token: 'adminToken',
        tests: [...status(200)],
      }),
      request('Reports', 'GET', '/api/admin/reports', {
        token: 'adminToken',
        tests: [...status(200)],
      }),
      request('Activity log', 'GET', '/api/admin/logs', {
        token: 'adminToken',
        tests: [...status(200)],
      }),
    ],
  },
  {
    name: '07 Rate limiting (run last: locks logins from this IP for 15 minutes)',
    item: Array.from({ length: 6 }, (_, index) =>
      request(
        `Failed login ${index + 1}${index === 5 ? ' is 429' : ''}`,
        'POST',
        '/api/auth/login',
        {
          body: { email: '{{userEmail}}', password: 'definitely-wrong-1A' },
          tests: index === 5 ? [...status(429), ...code('RATE_LIMITED')] : [],
        }
      )
    ),
  },
]

const collection = {
  info: {
    name: 'R4U API',
    description:
      'Every endpoint with its happy path and the error scenarios that matter. Start the API (npm run dev:server:memory seeds the demo accounts), then run the folders in order.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: folders,
}

const environment = {
  name: 'R4U local',
  values: [
    { key: 'baseUrl', value: 'http://localhost:5000', enabled: true },
    { key: 'userEmail', value: 'user@r4u.dev', enabled: true },
    { key: 'reviewerEmail', value: 'reviewer@r4u.dev', enabled: true },
    { key: 'adminEmail', value: 'admin@r4u.dev', enabled: true },
    { key: 'demoPassword', value: 'R4uDemo-2026!', enabled: true },
  ],
}

writeFileSync('docs/r4u.postman_collection.json', JSON.stringify(collection, null, 2) + '\n')
writeFileSync('docs/r4u.postman_environment.json', JSON.stringify(environment, null, 2) + '\n')
console.warn(
  `wrote ${folders.reduce((n, f) => n + f.item.length, 0)} requests in ${folders.length} folders`
)
