import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME, TEMPLATE_LIST, deltaE } from '@r4u/shared'
import { resumeToDocxBlob, resumeToParagraphs } from './renderToDocx'
import type { ParaSpec } from './renderToDocx'

const text = (p: ParaSpec) => p.runs.map((r) => (r.tab ? '\t' : r.text)).join('')
const lines = (key: string) =>
  resumeToParagraphs({ ...SAMPLE_RESUME, templateKey: key }).paragraphs.map(text)

describe('the DOCX adapter', () => {
  it('opens with the name and keeps a role and its dates on one line, behind a right tab', () => {
    const all = lines('foundry')
    expect(all[0]).toBe('Alex Mercer')
    expect(all).toContain('Senior Backend Engineer\tFeb 2023 – Present')
  })

  it('writes a two-column template as one column, main content before the sidebar', () => {
    const all = lines('recto')
    const experience = all.findIndex((line) => /work experience/i.test(line))
    const skills = all.findIndex((line) => /^skills$/i.test(line))
    expect(experience).toBeGreaterThan(-1)
    expect(skills).toBeGreaterThan(experience)
  })

  it('never leaves text in a colour that disappears on white paper', () => {
    for (const template of TEMPLATE_LIST) {
      const { theme, paragraphs } = resumeToParagraphs({
        ...SAMPLE_RESUME,
        templateKey: template.key,
      })
      for (const run of paragraphs.flatMap((p) => p.runs).filter((r) => r.text.trim())) {
        expect(deltaE(run.color, theme.paper)).toBeGreaterThanOrEqual(25)
      }
    }
  })

  it('builds a real Word file', async () => {
    const blob = await resumeToDocxBlob(SAMPLE_RESUME)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // a .docx is a zip: it opens with PK
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK')
    expect(bytes.length).toBeGreaterThan(4000)
  })
})
