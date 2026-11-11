import type { Resume } from '@r4u/shared'

// the docx library is needed only at the moment of export, so it loads on demand like react-pdf
export async function downloadDocx(resume: Partial<Resume>) {
  const { downloadResumeDocx } = await import('@/render/renderToDocx')
  await downloadResumeDocx(resume)
}
