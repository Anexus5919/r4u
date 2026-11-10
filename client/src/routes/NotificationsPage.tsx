import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NotificationItem } from '@r4u/shared'
import { useSocket, useSocketEvent } from '@/context/SocketContext'
import { useToast } from '@/context/ToastContext'
import { apiGet, apiPatch, toApiFailure } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { describeNotification } from '@/lib/notifications'
import { Button } from '@/components/ui/Button'
import { Card, Skeleton } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'

type Filter = 'all' | 'unread' | 'review'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'review', label: 'Review updates' },
]

export function NotificationsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { unread, setUnread } = useSocket()
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<NotificationItem[] | null>(null)

  const load = useCallback(() => {
    apiGet<{ notifications: NotificationItem[]; unread: number }>(`/notifications?filter=${filter}`)
      .then((data) => {
        setItems(data.notifications)
        setUnread(data.unread)
      })
      .catch((caught) => toast('danger', toApiFailure(caught).message))
  }, [filter, setUnread, toast])

  useEffect(() => load(), [load])

  // new ones arrive at the top in real time; a coalesced chat row moves up rather than duplicating
  useSocketEvent<{ notification: NotificationItem }>('notify:new', ({ notification }) => {
    if (filter === 'review' && !notification.type.startsWith('review')) return
    setItems((current) => [
      notification,
      ...(current ?? []).filter((item) => item._id !== notification._id),
    ])
  })

  async function markAll() {
    try {
      const { unread: count } = await apiPatch<{ unread: number }>('/notifications/read-all')
      setUnread(count)
      setItems(
        (current) =>
          current?.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) ??
          null
      )
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    }
  }

  async function open(item: NotificationItem) {
    if (!item.readAt) {
      const { unread: count } = await apiPatch<{ unread: number }>('/notifications/read', {
        ids: [item._id],
      }).catch(() => ({ unread }))
      setUnread(count)
    }
    navigate(
      item.entity.kind === 'review'
        ? item.type === 'review_requested' || item.type === 'review_declined'
          ? '/reviews'
          : `/reviews/${item.entity.id}`
        : '/dashboard'
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl text-ink-12">Notifications</h1>
          <p className="mt-1.5 text-sm text-ink-09">
            {unread > 0 ? `${unread} unread` : 'You are all caught up.'}
          </p>
        </div>
        <Button variant="secondary" disabled={unread === 0} onClick={() => void markAll()}>
          Mark all as read
        </Button>
      </div>

      <div className="mt-6">
        <Segmented
          label="Filter notifications"
          value={filter}
          onChange={setFilter}
          options={FILTERS}
        />
      </div>

      <Card className="mt-4 p-0">
        {items === null ? <Skeleton className="m-4 h-32" /> : null}
        {items?.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-ink-09">
            Nothing here. Review requests, comments and messages will show up as they happen.
          </p>
        ) : null}
        <ul>
          {items?.map((item) => (
            <li key={item._id} className="border-t border-ink-04 first:border-t-0">
              <button
                type="button"
                onClick={() => void open(item)}
                className={cn(
                  't-xs flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-ink-02',
                  !item.readAt && 'bg-accent-subtle'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-xs border border-accent',
                    item.readAt ? 'bg-transparent' : 'bg-accent'
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm text-ink-12', !item.readAt && 'font-medium')}>
                    {describeNotification(item)}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-09">
                    {formatRelative(item.createdAt)}
                    {item.readAt ? '' : ' · unread'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
