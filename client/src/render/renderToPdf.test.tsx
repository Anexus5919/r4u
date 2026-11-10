// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME, TEMPLATE_LIST } from '@r4u/shared'
import { ResumeDocument, pdfFileName, registerFonts } from './renderToPdf'

const FONTS = fileURLToPath(new URL('../../public/fonts', import.meta.url))

describe('renderToPdf', () => {
  registerFonts(FONTS)

  // the regression guard for react-pdf's infinite loop and for a template that cannot paginate
  it.each(TEMPLATE_LIST.map((template) => template.key))(
    'renders the sample resume through %s into a real PDF',
    async (key) => {
      const buffer = await renderToBuffer(
        <ResumeDocument resume={{ ...SAMPLE_RESUME, templateKey: key }} />
      )
      const head = buffer.subarray(0, 5).toString('latin1')
      const pages = buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []

      expect(head).toBe('%PDF-')
      expect(pages.length).toBeGreaterThanOrEqual(1)
      expect(buffer.length).toBeGreaterThan(5_000)
    },
    20_000
  )

  it('embeds the semibold face, so headings are not silently set at 400', async () => {
    const buffer = await renderToBuffer(<ResumeDocument resume={SAMPLE_RESUME} />)
    const text = buffer.toString('latin1')
    expect(text).toMatch(/SourceSans3-SemiBold|SourceSans3.*SemiBold/)
  }, 20_000)

  it('names the file after the person', () => {
    expect(pdfFileName(SAMPLE_RESUME)).toBe('Alex-Mercer.pdf')
  })
})
