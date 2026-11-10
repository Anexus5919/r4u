// every admin screen carries this line: a trust signal, and a boundary enforced in the data layer
export function AdminHeader({
  title,
  intro,
  action,
}: {
  title: string
  intro: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl text-ink-12">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-09">{intro}</p>
        <p className="mt-2 text-xs font-medium text-ink-10">
          Resume content is not visible to administrators.
        </p>
      </div>
      {action}
    </div>
  )
}
