import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { row, stack, text } from '@r4u/shared'
import type { LayoutNode } from '@r4u/shared'
import { renderToDom } from './renderToDom'

// renders one row and returns the elements of its children, in order
function rowChildren(children: LayoutNode[]): HTMLElement[] {
  const { container } = render(<>{renderToDom([row({}, children)])}</>)
  const rowElement = container.firstElementChild as HTMLElement
  return Array.from(rowElement.children) as HTMLElement[]
}

describe('renderToDom flex defaults', () => {
  // the regression: Verso's sidebar collapsed to a few characters beside long body bullets
  it('keeps a declared width from shrinking, matching Yoga', () => {
    const [sidebar, body] = rowChildren([
      stack({ width: 150 }, [text({}, 'sidebar')]),
      stack({ flexGrow: 1, flexShrink: 1 }, [text({}, 'body '.repeat(400))]),
    ])

    expect(sidebar?.style.flexShrink).toBe('0')
    expect(body?.style.flexShrink).toBe('1')
  })

  it('leaves an explicit flexShrink on a sized node alone', () => {
    const [sized] = rowChildren([stack({ width: 80, flexShrink: 1 }, [])])
    expect(sized?.style.flexShrink).toBe('1')
  })

  it('does not pin unsized text, which must still wrap inside a row', () => {
    const [label] = rowChildren([text({}, 'Senior Backend Engineer')])
    expect(label?.style.flexShrink).toBe('')
  })
})
