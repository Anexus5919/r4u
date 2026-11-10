import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SAMPLE_RESUME } from '@r4u/shared'
import { ResumePreview } from './ResumePreview'
import type { PreviewMetrics } from './ResumePreview'

// the editor's exact wiring: metrics held in parent state, so every report re-renders the preview
function Host({ onReport }: { onReport: (metrics: PreviewMetrics) => void }) {
  const [metrics, setMetrics] = useState<PreviewMetrics>({ overflowMm: 0, fill: 0 })
  return (
    <>
      <ResumePreview
        resume={SAMPLE_RESUME}
        onMetrics={(next) => {
          onReport(next)
          setMetrics(next)
        }}
      />
      <p>overflow {metrics.overflowMm}</p>
    </>
  )
}

describe('ResumePreview metrics', () => {
  it('settles instead of looping when the parent stores the metrics in state', () => {
    const onReport = vi.fn()
    render(<Host onReport={onReport} />)

    expect(screen.getByText(/^overflow \d+$/)).toBeInTheDocument()
    expect(onReport).toHaveBeenCalledTimes(1)
  })

  it('renders the resume owner as live text', () => {
    render(<ResumePreview resume={SAMPLE_RESUME} />)
    expect(screen.getAllByText(SAMPLE_RESUME.personal.fullName).length).toBeGreaterThan(0)
  })
})
