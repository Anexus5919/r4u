import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SAMPLE_RESUME, toJsonResume } from '@r4u/shared'
import { useToast } from '@/context/ToastContext'
import { api, toApiFailure } from '@/lib/api'

const TITLE_MAX = 80

/** Creates a resume from a JSON Resume document, a file, or the built-in sample, then opens it. */
export function useResumeImport() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const importDocument = useCallback(
    async (document: unknown, title?: string) => {
      setBusy(true)
      try {
        const res = await api.post('/resumes/import', { document, title })
        const { resume, skipped } = res.data.data as { resume: { id: string }; skipped: string[] }

        // named rather than silent, so the user knows what to re-enter by hand
        if (skipped.length > 0) toast('info', `Imported. Not carried over: ${skipped.join(', ')}.`)
        else toast('success', 'Resume imported')

        navigate(`/resume/${resume.id}/edit`)
      } catch (caught) {
        toast('danger', toApiFailure(caught).message)
      } finally {
        setBusy(false)
      }
    },
    [navigate, toast]
  )

  const fromFile = useCallback(
    async (file: File) => {
      let document: unknown
      try {
        document = JSON.parse(await file.text())
      } catch {
        toast('danger', 'That file is not valid JSON. Export a JSON Resume file and try again.')
        return
      }

      const title = file.name
        .replace(/\.json$/i, '')
        .trim()
        .slice(0, TITLE_MAX)
      await importDocument(document, title || undefined)
    },
    [importDocument, toast]
  )

  const fromSample = useCallback(
    () => importDocument(toJsonResume(SAMPLE_RESUME), 'Sample resume'),
    [importDocument]
  )

  return { busy, fromFile, fromSample }
}
