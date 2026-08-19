import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PT_TO_PX, getTemplate, resolveTheme, splitGrounds, toTemplateResume } from '@r4u/shared'
import type { Resume } from '@r4u/shared'
import { renderToDom } from './renderToDom'

/*
  The preview is a real 210mm by 297mm box, scaled with a transform rather than laid out at some
  convenient pixel size and hoped to match.

  Authoring in physical units removes an entire class of rounding drift against the PDF: a 20mm
  margin here is a 20mm margin there, not "about 75 pixels".
*/

const A4_MM = { width: 210, height: 297 }
const MM_TO_PX = 96 / 25.4

export interface PreviewMetrics {
  /** how far past the page the content runs, in millimetres. zero when it fits */
  overflowMm: number
  /** how full the page is, as a fraction. above 1 means it does not fit */
  fill: number
}

export function ResumePreview({
  resume,
  onMetrics,
}: {
  resume: Partial<Resume>
  onMetrics?: (metrics: PreviewMetrics) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const template = getTemplate(resume.templateKey ?? 'foundry')
  const theme = resolveTheme(
    resume.design ?? {
      accent: '',
      typeScale: 10.5,
      leading: 1.35,
      sectionSpacing: 'normal',
      margins: 20,
    }
  )
  const { grounds, flow } = splitGrounds(
    template.render({ resume: toTemplateResume(resume), theme })
  )

  // scale to the available width, measured rather than assumed, so the panel can be any size
  useEffect(() => {
    const element = frame.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const available = entry?.contentRect.width ?? 0
      setScale(Math.min(1, available / (A4_MM.width * MM_TO_PX)))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /*
    Measured after layout, every render, because the content changes on every keystroke. Phase 7
    replaces this with the page count the PDF renderer reports, which is the only number that can
    be exactly right, but a DOM measurement is what makes the warning live while typing.
  */
  useLayoutEffect(() => {
    if (!onMetrics || !content.current || !page.current) return

    const contentHeight = content.current.scrollHeight
    const available = page.current.clientHeight - 2 * theme.margin * PT_TO_PX
    const overflowPx = Math.max(0, contentHeight - available)

    onMetrics({
      overflowMm: Math.round(overflowPx / MM_TO_PX),
      fill: available > 0 ? contentHeight / available : 0,
    })
  })

  return (
    <div ref={frame} className="w-full">
      <div
        style={{
          height: A4_MM.height * MM_TO_PX * scale,
          // the scaled box still has to reserve its real height in the flow
          width: A4_MM.width * MM_TO_PX * scale,
        }}
      >
        <div
          ref={page}
          /*
            The paper is true white in both themes and carries a visible edge. It has to be the
            figure on the screen and the application the ground, which is the whole reason the
            chrome is achromatic.
          */
          className="paper border border-ink-05 shadow-none"
          style={{
            width: `${A4_MM.width}mm`,
            height: `${A4_MM.height}mm`,
            padding: `${theme.margin * PT_TO_PX}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            // grounds are absolute against this box
            position: 'relative',
            // document defaults, matched on the PDF Page: an unset family is Helvetica there
            fontFamily: theme.sans,
            lineHeight: theme.leading,
            color: theme.ink,
          }}
        >
          {renderToDom(grounds, 'g')}

          <div
            ref={content}
            style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
          >
            {renderToDom(flow)}
          </div>
        </div>
      </div>
    </div>
  )
}
