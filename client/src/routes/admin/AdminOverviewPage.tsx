import { useEffect, useState } from 'react'
import type { ActivityEntry, AdminStats, LiveStats } from '@r4u/shared'
import { emitWithAck, useSocket, useSocketEvent } from '@/context/SocketContext'
import { apiGet, toApiFailure } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { Banner } from '@/components/ui/Banner'
import { Card, Skeleton } from '@/components/ui/Card'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table'
import { AdminHeader } from './AdminHeader'

// monochrome by rule: one accent series, the comparison series in ink, ordered by value not hue
function SeriesChart({ series }: { series: AdminStats['series'] }) {
  const max = Math.max(1, ...series.flatMap((day) => [day.registrations, day.resumes]))
  const barW = 10
  const gap = 8
  const height = 120

  return (
    <figure>
      <svg
        viewBox={`0 0 ${series.length * (barW * 2 + gap)} ${height + 18}`}
        className="h-44 w-full"
        role="img"
        aria-label="Registrations and resumes created per day, last 14 days"
      >
        {series.map((day, index) => {
          const x = index * (barW * 2 + gap)
          const r = (day.registrations / max) * height
          const m = (day.resumes / max) * height
          return (
            <g key={day.date}>
              <rect
                x={x}
                y={height - r}
                width={barW}
                height={Math.max(r, 1)}
                className="fill-accent"
              >
                <title>{`${day.date}: ${day.registrations} registrations`}</title>
              </rect>
              <rect
                x={x + barW}
                y={height - m}
                width={barW}
                height={Math.max(m, 1)}
                className="fill-ink-06"
              >
                <title>{`${day.date}: ${day.resumes} resumes`}</title>
              </rect>
              {index % 2 === 0 ? (
                <text
                  x={x + barW}
                  y={height + 14}
                  textAnchor="middle"
                  className="fill-ink-08 text-[8px]"
                >
                  {day.date.slice(5)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-2 flex gap-5 text-xs text-ink-09">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-accent" /> Registrations
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-xs bg-ink-06" /> Resumes created
        </span>
      </figcaption>
    </figure>
  )
}

export function AdminOverviewPage() {
  const { socket, status } = useSocket()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [live, setLive] = useState<LiveStats | null>(null)
  const [logs, setLogs] = useState<ActivityEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<AdminStats>('/admin/stats')
      .then((data) => {
        setStats(data)
        setLive(data.live)
      })
      .catch((caught) => setError(toApiFailure(caught).message))
    apiGet<{ logs: ActivityEntry[] }>('/admin/logs?limit=8')
      .then(({ logs: recent }) => setLogs(recent))
      .catch(() => undefined)
  }, [])

  // live sessions arrive every five seconds while this page is subscribed, and stop when it is not
  useEffect(() => {
    if (!socket || status !== 'connected') return
    void emitWithAck<{ snapshot: LiveStats }, 'admin:live_subscribe'>(
      socket,
      'admin:live_subscribe',
      {}
    ).then((reply) => {
      if (reply.ok) setLive(reply.snapshot)
    })
  }, [socket, status])

  useSocketEvent<LiveStats>('admin:live_stats', setLive)

  const cards = stats
    ? [
        {
          label: 'Total users',
          value: stats.users.total,
          note: `${stats.users.reviewer} reviewers, ${stats.users.blocked} blocked`,
        },
        {
          label: 'Resumes created',
          value: stats.resumes,
          note: `${stats.shareLinks} live share links`,
        },
        {
          label: 'Active templates',
          value: stats.activeTemplates,
          note: 'Offered for new resumes',
        },
        {
          label: 'Live sessions',
          value: live?.connectedUsers ?? 0,
          note: `${live?.activeReviewRooms ?? 0} review rooms open`,
        },
      ]
    : []

  return (
    <div className="mx-auto max-w-7xl">
      <AdminHeader title="Overview" intro="Platform health and usage, updated live." />

      {error ? <Banner className="mt-6">{error}</Banner> : null}

      {stats ? (
        <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.label} className="p-5">
              <dt className="text-sm text-ink-09">{card.label}</dt>
              <dd className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-ink-12 tabular-nums">
                {card.value}
              </dd>
              <dd className="mt-1 text-xs text-ink-09">{card.note}</dd>
            </Card>
          ))}
        </dl>
      ) : (
        !error && <Skeleton className="mt-8 h-28" />
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <h2 className="text-md text-ink-12">Last 14 days</h2>
          {stats ? (
            <div className="mt-4">
              <SeriesChart series={stats.series} />
            </div>
          ) : (
            <Skeleton className="mt-4 h-44" />
          )}
          {stats ? (
            <p className="mt-4 text-sm text-ink-09">
              Reviews: {stats.reviews.active} active, {stats.reviews.completed} completed,{' '}
              {stats.reviews.total} in all.
            </p>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-md text-ink-12">Recent activity</h2>
          <div className="mt-3 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Who</TH>
                  <TH>Action</TH>
                  <TH numeric>When</TH>
                </TR>
              </THead>
              <TBody>
                {logs.map((entry) => (
                  <TR key={entry.id}>
                    <TD>
                      {entry.actor?.name ?? (entry.actorDeleted ? 'Deleted account' : 'Visitor')}
                    </TD>
                    <TD className="font-mono text-xs">{entry.action}</TD>
                    <TD numeric className="text-xs text-ink-09">
                      {formatRelative(entry.at)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
