import { useCallback, useEffect, useState } from 'react'
import type { ActivityEntry, PublicResume, ReportItem, ReportStatus, Resume } from '@r4u/shared'
import { ResumePreview } from '@/render/ResumePreview'
import { useToast } from '@/context/ToastContext'
import { api, apiGet, apiPatch, toApiFailure } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { Card, StatusLabel } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/Table'
import { AdminHeader } from './AdminHeader'

const REASON: Record<string, string> = {
  spam: 'Spam',
  impersonation: 'Impersonation',
  offensive: 'Offensive',
  personal_data: "Someone else's data",
  other: 'Other',
}

function Reports() {
  const { toast } = useToast()
  const [status, setStatus] = useState<ReportStatus | ''>('open')
  const [reports, setReports] = useState<ReportItem[]>([])
  const [preview, setPreview] = useState<PublicResume | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = useCallback(() => {
    apiGet<{ reports: ReportItem[] }>(`/admin/reports${status ? `?status=${status}` : ''}`)
      .then(({ reports: list }) => setReports(list))
      .catch((caught) => toast('danger', toApiFailure(caught).message))
  }, [status, toast])

  useEffect(() => load(), [load])

  async function handle(report: ReportItem, action: 'disable_link' | 'dismiss') {
    try {
      await apiPatch(`/admin/reports/${report.id}`, { action })
      toast(
        'success',
        action === 'dismiss' ? 'Report dismissed' : 'Link disabled and report closed'
      )
      load()
    } catch (caught) {
      toast('danger', toApiFailure(caught).message)
    }
  }

  async function view(report: ReportItem) {
    setPreview(null)
    setPreviewError(null)
    setPreviewOpen(true)
    try {
      const { resume } = await apiGet<{ resume: PublicResume }>(
        `/admin/reports/${report.id}/preview`
      )
      setPreview(resume)
    } catch (caught) {
      setPreviewError(toApiFailure(caught).message)
    }
  }

  return (
    <>
      <Segmented
        label="Report status"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'actioned', label: 'Actioned' },
          { value: 'dismissed', label: 'Dismissed' },
          { value: '', label: 'All' },
        ]}
      />
      <Card className="mt-4 overflow-x-auto p-0">
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Reason</TH>
              <TH>Details</TH>
              <TH>Link</TH>
              <TH>Reported</TH>
              <TH>Status</TH>
              <TH numeric className="pr-5">
                Action
              </TH>
            </TR>
          </THead>
          <TBody>
            {reports.map((report) => (
              <TR key={report.id}>
                <TD className="pl-5 font-medium text-ink-12">
                  {REASON[report.reason] ?? report.reason}
                </TD>
                <TD className="max-w-xs text-sm text-ink-10">{report.snippet || 'None given'}</TD>
                <TD className="font-mono text-xs">
                  {report.shareLink ? `…${report.shareLink.hint}` : 'Deleted'}
                </TD>
                <TD className="text-xs text-ink-09">
                  {formatRelative(report.createdAt)}
                  {report.reporter ? ` by ${report.reporter.name}` : ' by a visitor'}
                </TD>
                <TD>
                  <StatusLabel on={report.status === 'open'}>{report.status}</StatusLabel>
                </TD>
                <TD numeric className="pr-5">
                  <div className="flex justify-end gap-2">
                    {report.shareLink?.enabled ? (
                      <Button size="sm" variant="ghost" onClick={() => void view(report)}>
                        View page
                      </Button>
                    ) : null}
                    {report.status === 'open' ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handle(report, 'dismiss')}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void handle(report, 'disable_link')}
                        >
                          Disable link
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {reports.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-09">No reports here.</p>
        ) : null}
      </Card>

      <Modal
        open={previewOpen}
        size="lg"
        onClose={() => setPreviewOpen(false)}
        title="Reported page, as the public sees it"
        description="Only pages with a live public link can be shown. A private resume never reaches this screen."
      >
        {previewError ? <Banner>{previewError}</Banner> : null}
        {preview ? (
          <div className="max-h-[65vh] overflow-y-auto bg-ink-02 p-4">
            <ResumePreview resume={preview as unknown as Partial<Resume>} />
          </div>
        ) : null}
      </Modal>
    </>
  )
}

function Logs() {
  const [logs, setLogs] = useState<ActivityEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    api
      .get(`/admin/logs?page=${page}&limit=20`)
      .then((res) => {
        setLogs(res.data.data.logs)
        setTotalPages(res.data.meta.totalPages)
      })
      .catch(() => undefined)
  }, [page])

  return (
    <>
      <p className="text-sm text-ink-09">
        Kept for 180 days, then removed automatically. Details never include resume content.
      </p>
      <Card className="mt-4 overflow-x-auto p-0">
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">When</TH>
              <TH>Who</TH>
              <TH>Action</TH>
              <TH>Target</TH>
              <TH className="pr-5">Details</TH>
            </TR>
          </THead>
          <TBody>
            {logs.map((entry) => (
              <TR key={entry.id}>
                <TD className="pl-5 text-xs text-ink-09">{new Date(entry.at).toLocaleString()}</TD>
                <TD>{entry.actor?.name ?? 'Visitor'}</TD>
                <TD className="font-mono text-xs">{entry.action}</TD>
                <TD className="text-xs text-ink-09">{entry.targetType}</TD>
                <TD className="pr-5 font-mono text-xs text-ink-09">
                  {Object.entries(entry.meta)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(', ')}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm text-ink-09">
        <span>
          Page {page} of {totalPages}
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
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}

export function AdminReportsPage() {
  const [tab, setTab] = useState<'reports' | 'logs'>('reports')

  return (
    <div className="mx-auto max-w-7xl">
      <AdminHeader
        title="Reports and activity"
        intro="Reported share links, and a log of significant actions."
      />
      <div className="mt-8">
        <Segmented
          label="View"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'reports', label: 'Reported content' },
            { value: 'logs', label: 'Activity log' },
          ]}
        />
      </div>
      <div className="mt-6">{tab === 'reports' ? <Reports /> : <Logs />}</div>
    </div>
  )
}
