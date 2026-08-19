import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>Export as A4 PDF</Button>)
    expect(screen.getByRole('button', { name: 'Export as A4 PDF' })).toBeInTheDocument()
  })

  it('swaps the label while loading rather than appending a spinner', () => {
    render(<Button loading>Save draft</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveTextContent('Working')
    expect(button).not.toHaveTextContent('Save draft')
  })

  it('carries no pill radius and no shadow', () => {
    render(<Button>Share</Button>)
    const className = screen.getByRole('button').className
    expect(className).toContain('rounded-xs')
    expect(className).not.toMatch(/rounded-(full|md|lg|xl)/)
    expect(className).not.toMatch(/shadow/)
  })

  it('lets a caller override a default class', () => {
    render(<Button className="h-12">Tall</Button>)
    expect(screen.getByRole('button').className).toContain('h-12')
    expect(screen.getByRole('button').className).not.toContain('h-9')
  })
})
