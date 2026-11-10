import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PT_TO_PX, getTemplate, resolveTheme, splitGrounds, toTemplateResume } from '@r4u/shared'
import type { Resume } from '@r4u/shared'
import { renderToDom } from './renderToDom'

// a real 210mm by 297mm box scaled by transform, so margins match the PDF

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
  const reported = useRef<PreviewMetrics | null>(null)
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

  // measured after every layout so the overflow warning is live while typing
  useLayoutEffect(() => {
    if (!onMetrics || !content.current || !page.current) return

    const contentHeight = content.current.scrollHeight
    const available = page.current.clientHeight - 2 * theme.margin * PT_TO_PX
    const overflowPx = Math.max(0, contentHeight - available)

    const next: PreviewMetrics = {
      overflowMm: Math.round(overflowPx / MM_TO_PX),
      fill: available > 0 ? Math.round((contentHeight / available) * 1000) / 1000 : 0,
    }

    // an unchanged report still re-renders a parent holding it in state, which loops forever
    const last = reported.current
    if (last && last.overflowMm === next.overflowMm && last.fill === next.fill) return

    reported.current = next
    onMetrics(next)
  })

  return (
    <div ref={frame} className="w-full min-w-0">
      <div
        style={{
          height: A4_MM.height * MM_TO_PX * scale,
          // the scaled box still has to reserve its real height in the flow
          width: A4_MM.width * MM_TO_PX * scale,
          maxWidth: '100%',
          // a transform shrinks the paint, not the layout box, which would otherwise scroll a phone sideways
          overflow: 'hidden',
        }}
      >
        <div
          ref={page}
          // true white paper with an edge in both themes: the only figure on screen
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
