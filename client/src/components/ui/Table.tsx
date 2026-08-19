import { cn } from '@/lib/cn'

/*
  No zebra striping, no vertical rules, no coloured pills. A 1px horizontal rule between rows,
  numeric columns right-aligned with tabular figures, and a sticky header that is neither bold
  nor uppercase. Row hover shifts the ground only.
*/

export function Table({ className, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...rest} />
    </div>
  )
}

export function THead({ className, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 bg-ink-01', className)} {...rest} />
}

export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}

export function TR({ className, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('t-xs border-b border-ink-04 transition-colors hover:bg-ink-02', className)}
      {...rest}
    />
  )
}

export interface CellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean
}

export function TH({ numeric, className, ...rest }: CellProps) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-ink-04 px-4 py-3 text-left font-normal tracking-[0.04em] text-ink-09',
        'text-xs',
        numeric && 'text-right',
        className
      )}
      {...rest}
    />
  )
}

export function TD({ numeric, className, ...rest }: CellProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-ink-11',
        numeric && 'text-right font-mono tabular-nums',
        className
      )}
      {...rest}
    />
  )
}
