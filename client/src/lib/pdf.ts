import type { Resume } from '@r4u/shared'

// react-pdf is a large module needed only at the moment of export, so it loads on demand
export async function downloadPdf(resume: Partial<Resume>) {
  const { downloadResumePdf } = await import('@/render/renderToPdf')
  await downloadResumePdf(resume)
}
