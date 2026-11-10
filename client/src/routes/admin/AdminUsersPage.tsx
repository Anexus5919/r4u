import { useCallback, useEffect, useState } from 'react'
import type { AdminUserRow, AuthenticatedRole, UserStatus } from '@r4u/shared'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useDebounce } from '@/hooks/useDebounce'
import { api, apiPatch, toApiFailure } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Card, StatusLabel } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table'
import { AdminHeader } from './AdminHeader'

const ROLE_OPTIONS: { value: AuthenticatedRole | ''; label: string }[] = [
  { value: '', label: 'All roles' },
  { value: 'user', label: 'Users' },
  { value: 'reviewer', label: 'Reviewers' },
  { value: 'admin', label: 'Admins' },
]

const STATUS_OPTIONS: { value: UserStatus | ''; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
]

const LIMIT = 10

interface Meta {
  page: number
  totalPages: number
  total: number
}

export function AdminUsersPage() {
  const { user: me } = useAuth()
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<AuthenticatedRole | ''>('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [meta, setMeta] = useState<Meta>({ page: 1, totalPages: 1, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<AdminUserRow | null>(null)
  const debounced = useDebounce(q)

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (debounced) params.set('q', debounced)
    if (role) params.set('role', role)
    if (status) params.set('status', status)
    api
      .get(`/admin/users?${params.toString()}`)
      .then((res) => {
        setRows(res.data.data.users)
        setMeta(res.data.meta)
        setError(null)
      })
      .catch((caught) => setError(toApiFailure(caught).message))
  }, [debounced, role, status, page])

  useEffect(() => load(), [load])

  function replace(updated: AdminUserRow) {
    setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)))
  }

  async function changeRole(row: AdminUserRow, next: AuthenticatedRole) {
    try {
      const { user } = await apiPatch<{ user: AdminUserRow }>(`/admin/users/${row.id}/role`, {
        role: next,
      })
      replace(user)
      toast(
        'success',
        `${row.name} is now ${next === 'user' ? 'a user' : `an ${next === 'admin' ? 'admin' : 'reviewer'}`}`
      )
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    }
  }

  async function confirmStatus() {
    if (!pending) return
    const next: UserStatus = pending.status === 'active' ? 'blocked' : 'active'
    try {
      const { user } = await apiPatch<{ user: AdminUserRow }>(`/admin/users/${pending.id}/status`, {
        status: next,
      })
      replace(user)
      toast(
        'success',
        next === 'blocked'
          ? `${pending.name} is blocked and signed out everywhere`
          : `${pending.name} is unblocked`
      )
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <AdminHeader
        title="Users"
        intro={`${meta.total} accounts. Role changes and blocks take effect immediately.`}
      />

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Icon name="search" className="pointer-events-none absolute top-3 left-3 text-ink-08" />
          <Input
            aria-label="Search by name or email"
            placeholder="Search by name or email"
            className="pl-9"
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="flex flex-wrap gap-3 lg:ml-auto">
          <Segmented
            label="Role"
            value={role}
            onChange={(v) => {
              setRole(v)
              setPage(1)
            }}
            options={ROLE_OPTIONS}
          />
          <Segmented
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {error ? <Banner className="mt-6">{error}</Banner> : null}

      <Card className="mt-4 overflow-x-auto p-0">
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH numeric>Resumes</TH>
              <TH>Status</TH>
              <TH>Last seen</TH>
              <TH numeric className="pr-5">
                Action
              </TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => {
              const self = row.id === me?.id
              return (
                <TR key={row.id}>
                  <TD className="pl-5 font-medium text-ink-12">{row.name}</TD>
                  <TD className="text-ink-10">{row.email}</TD>
                  <TD>
                    <select
                      aria-label={`Role for ${row.name}`}
                      value={row.role}
                      disabled={self}
                      onChange={(event) =>
                        void changeRole(row, event.target.value as AuthenticatedRole)
                      }
                      className="h-8 rounded-xs border border-ink-05 bg-ink-00 px-2 text-sm text-ink-12 disabled:opacity-50"
                    >
                      <option value="user">User</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </TD>
                  <TD numeric>{row.resumeCount}</TD>
                  <TD>
                    <StatusLabel on={row.status === 'active'}>
                      {row.status === 'active' ? 'Active' : 'Blocked'}
                    </StatusLabel>
                  </TD>
                  <TD className="text-xs text-ink-09">
                    {row.lastSeenAt ? formatRelative(row.lastSeenAt) : 'Never'}
                  </TD>
                  <TD numeric className="pr-5">
                    <Button
                      size="sm"
                      variant={row.status === 'active' ? 'danger' : 'secondary'}
                      disabled={self}
                      onClick={() => setPending(row)}
                    >
                      {row.status === 'active' ? 'Block' : 'Unblock'}
                    </Button>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
        {rows.length === 0 && !error ? (
          <p className="px-5 py-10 text-center text-sm text-ink-09">No accounts match.</p>
        ) : null}
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-09">
        <span>
          Page {meta.page} of {meta.totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={
          pending?.status === 'active' ? `Block ${pending?.name}?` : `Unblock ${pending?.name}?`
        }
        description={
          pending?.status === 'active'
            ? 'They are signed out on every device at once and cannot sign in until unblocked. Their resumes are kept.'
            : 'They can sign in again straight away.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={pending?.status === 'active' ? 'danger' : 'primary'}
              onClick={() => void confirmStatus()}
            >
              {pending?.status === 'active' ? 'Block account' : 'Unblock account'}
            </Button>
          </>
        }
      />
    </div>
  )
}
