import { useCallback, useEffect, useState } from 'react'
import type { ResumeStatus, ResumeSummary } from '@r4u/shared'
import { apiGet, toApiFailure } from '@/lib/api'
import type { ApiFailure } from '@/lib/api'

export interface ResumeQuery {
  q: string
  status: ResumeStatus | ''
  sort: 'updated' | 'created' | 'title'
}

interface ListResponse {
  resumes: ResumeSummary[]
}

export interface ResumeListState {
  resumes: ResumeSummary[]
  status: 'loading' | 'ready' | 'error'
  error: ApiFailure | null
  reload: () => void
}

function toSearch(query: ResumeQuery): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.status) params.set('status', query.status)
  if (query.sort !== 'updated') params.set('sort', query.sort)
  const search = params.toString()
  return search ? `?${search}` : ''
}

// hand-written fetch (ADR-010); AbortController makes the newest search win
export function useResumes(query: ResumeQuery): ResumeListState {
  const [resumes, setResumes] = useState<ResumeSummary[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<ApiFailure | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const search = toSearch(query)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    apiGet<ListResponse>(`/resumes${search}`, controller.signal)
      .then((data) => {
        setResumes(data.resumes)
        setStatus('ready')
        setError(null)
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        setError(toApiFailure(caught))
        setStatus('error')
      })

    return () => controller.abort()
  }, [search, nonce])

  return { resumes, status, error, reload }
}
