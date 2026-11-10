import { cn } from '@/lib/cn'

// a schematic of the template's layout; the list endpoint carries no content, by design
const BAR = 'h-[3px] rounded-xs bg-paper-ink opacity-15'
const HEAD = 'h-[3px] rounded-xs bg-paper-ink opacity-40'

function Lines({ count, className }: { count: number; className?: string }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-3/4', 'w-5/6']
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn(BAR, widths[index % widths.length])} />
      ))}
    </div>
  )
}

function Section({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cn(HEAD, 'w-1/3')} />
      <Lines count={lines} />
    </div>
  )
}

function Body() {
  return (
    <div className="flex flex-col gap-4">
      <Section lines={3} />
      <Section lines={4} />
      <Section lines={2} />
    </div>
  )
}

export function TemplateTile({
  templateKey,
  className,
}: {
  templateKey: string
  className?: string
}) {
  const header = (
    <div className={cn('flex flex-col gap-1.5', templateKey === 'broadsheet' && 'items-center')}>
      <div className="h-[5px] w-1/2 rounded-xs bg-paper-ink opacity-70" />
      <div className={cn(BAR, 'w-2/3')} />
    </div>
  )

  return (
    <div
      aria-hidden
      className={cn(
        'paper relative aspect-[210/297] w-full overflow-hidden border border-ink-04',
        className
      )}
    >
      {templateKey === 'placard' ? (
        <div className="bg-paper-ink px-[12%] py-[9%]">
          <div className="h-[5px] w-1/2 rounded-xs bg-paper opacity-90" />
          <div className="mt-1.5 h-[3px] w-2/3 rounded-xs bg-paper opacity-40" />
        </div>
      ) : null}

      {templateKey === 'verso' ? (
        <div className="absolute inset-y-0 left-0 w-[30%] bg-paper-ink opacity-[0.06]" />
      ) : null}

      <div className="relative flex flex-col gap-4 px-[12%] py-[10%]">
        {templateKey === 'placard' ? null : header}

        {templateKey === 'recto' ? (
          <div className="flex gap-3">
            <Body />
            <div className="w-[34%] shrink-0">
              <Section lines={5} />
            </div>
          </div>
        ) : templateKey === 'verso' ? (
          <div className="flex gap-3">
            <div className="w-[26%] shrink-0">
              <Section lines={5} />
            </div>
            <Body />
          </div>
        ) : templateKey === 'marginalia' ? (
          <div className="flex gap-3">
            <div className="flex w-[18%] shrink-0 flex-col gap-10 pt-1">
              <div className={cn(HEAD, 'w-full')} />
              <div className={cn(HEAD, 'w-full')} />
            </div>
            <Body />
          </div>
        ) : (
          <Body />
        )}
      </div>
    </div>
  )
}
