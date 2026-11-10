import type { Resume } from '@r4u/shared'
import { ResumePreview } from '@/render/ResumePreview'
import { cn } from '@/lib/cn'

// a real render, hidden from assistive tech because the caption beside it names what it shows
export function Sheet({ resume, className }: { resume: Partial<Resume>; className?: string }) {
  return (
    <div aria-hidden className={cn('sheet pointer-events-none select-none', className)}>
      <ResumePreview resume={resume} />
    </div>
  )
}
