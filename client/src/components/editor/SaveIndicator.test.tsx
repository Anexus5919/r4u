import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SaveIndicator } from './CoachPanel'

describe('SaveIndicator', () => {
  // the regression: a freshly opened resume announced unsaved changes before any edit
  it('reports a clean document as saved on first load', () => {
    render(<SaveIndicator status="idle" dirty={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('All changes saved')
  })

  it('reports pending edits as unsaved', () => {
    render(<SaveIndicator status="saved" dirty />)
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
  })

  it('lets saving and error win over a dirty document', () => {
    const { rerender } = render(<SaveIndicator status="saving" dirty />)
    expect(screen.getByRole('status')).toHaveTextContent('Saving')

    rerender(<SaveIndicator status="error" dirty />)
    expect(screen.getByRole('status')).toHaveTextContent('Could not save')
  })
})
