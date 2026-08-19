/*
  Neither date-fns nor dayjs. R4U's only date needs are a YYYY-MM month input and a short
  display date, both of which Intl already does. See ADR-013.
*/

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso))
}

const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' })

/** Renders a YYYY-MM month string the way a resume prints it: "Mar 2021". */
export function formatMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month
  const [year, index] = month.split('-')
  return MONTH_YEAR.format(new Date(Number(year), Number(index) - 1, 1))
}

export function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return formatDate(iso)
}
