import { Font, pdf } from '@react-pdf/renderer'
import type { Resume } from '@r4u/shared'
import { ResumeDocument } from './PdfDocument'

// the PDF half of "one layout AST, two adapters"; never imported eagerly, it is a large module

const TIMEOUT_MS = 10_000

const FAMILIES = [
  { family: 'Source Serif 4', file: 'SourceSerif4' },
  { family: 'Source Sans 3', file: 'SourceSans3' },
]

let registeredBase: string | null = null

/** Static per-weight TTFs only: a variable font renders every weight at 400 in react-pdf. */
export function registerFonts(base: string) {
  if (registeredBase === base) return
  registeredBase = base

  for (const { family, file } of FAMILIES) {
    Font.register({
      family,
      fonts: [
        { src: `${base}/${file}-Regular.ttf`, fontWeight: 400 },
        { src: `${base}/${file}-SemiBold.ttf`, fontWeight: 600 },
        { src: `${base}/${file}-RegularItalic.ttf`, fontWeight: 400, fontStyle: 'italic' },
      ],
    })
  }

  // a hyphenated keyword is a missed keyword for a parser, so words never break
  Font.registerHyphenationCallback((word) => [word])
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  // react-pdf issue 2659 can loop forever on some break combinations; never hang the tab
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('PDF rendering took too long')), TIMEOUT_MS)
    ),
  ])
}

export async function resumeToPdfBlob(resume: Partial<Resume>, fontBase?: string): Promise<Blob> {
  registerFonts(fontBase ?? `${window.location.origin}/fonts`)
  return withTimeout(pdf(<ResumeDocument resume={resume} />).toBlob())
}

export function pdfFileName(resume: Partial<Resume>) {
  const base = resume.personal?.fullName || resume.title || 'resume'
  return `${base.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'resume'}.pdf`
}

/** Renders and saves the file, with a real text layer the ATS parsers can read. */
export async function downloadResumePdf(resume: Partial<Resume>) {
  const blob = await resumeToPdfBlob(resume)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = pdfFileName(resume)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
