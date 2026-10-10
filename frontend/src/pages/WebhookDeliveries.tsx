import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Send } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { formatDate, humanize, shortId } from '../lib/format'
import type { Page, WebhookEvent, WebhookEventStatus } from '../lib/types'
import {
  Button, Card, Empty, Field, KeyValue, Modal, Notice, PageHeader, Pager, Select, Spinner, StatusBadge, useToast,
} from '../components/ui'

const STATUSES: WebhookEventStatus[] = ['PENDING', 'DELIVERED', 'FAILED', 'DEAD']

export default function WebhookDeliveries() {
  const toast = useToast()
  const [status, setStatus] = useState<WebhookEventStatus | ''>('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<WebhookEvent> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(() => {
    api.listWebhookEvents({ status: status || undefined, page, size: 15 })
      .then(setData)
      .catch((e: ApiError) => { toast(e.message, 'bad'); setData({ items: [], page: 0, size: 15, totalItems: 0, totalPages: 0 }) })
  }, [status, page, toast])
  useEffect(load, [load])

  return (
    <>
      <PageHeader
        title="Webhook deliveries"
        subtitle="Every event sent to your endpoints, with retry state. Failed deliveries retry with backoff, then land in the dead-letter queue."
        action={<Button variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <div className="w-48">
            <Field label="Status">
              <Select value={status} onChange={(e) => { setStatus(e.target.value as WebhookEventStatus | ''); setPage(0) }}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        {data === null ? <Spinner /> : data.items.length === 0 ? (
          <Empty icon={<Send className="h-5 w-5" />} title="No deliveries yet"
            hint="Add an endpoint, then make a payment. Events show up here as they are sent." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">Event</th>
                  <th className="px-3 py-3 font-medium">Endpoint</th>
                  <th className="px-3 py-3 font-medium">When</th>
                  <th className="px-3 py-3 text-right font-medium">Attempts</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((e) => (
                  <tr key={e.id} onClick={() => setSelected(e.id)} className="cursor-pointer hover:bg-raised/50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{humanize(e.eventType)}</p>
                      <p className="font-mono text-xs text-muted">{shortId(e.id)}</p>
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-3.5 font-mono text-xs text-muted">{e.targetUrl}</td>
                    <td className="px-3 py-3.5 text-muted">{formatDate(e.createdAt)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{e.attempts}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} onPage={setPage} />}
      </Card>

      <EventDetail id={selected} onClose={() => setSelected(null)} onChanged={load} />
    </>
  )
}

function EventDetail({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [event, setEvent] = useState<WebhookEvent | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setEvent(null)
    if (id) api.getWebhookEvent(id).then(setEvent).catch((e: ApiError) => toast(e.message, 'bad'))
  }, [id, toast])

  async function replay() {
    if (!event) return
    setBusy(true)
    try {
      setEvent(await api.replayWebhookEvent(event.id))
      toast('Queued for redelivery')
      onChanged()
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not replay', 'bad') }
    finally { setBusy(false) }
  }

  return (
    <Modal open={!!id} onClose={onClose} title="Delivery details" size="lg">
      {!event ? <Spinner /> : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">{humanize(event.eventType)}</span>
            <StatusBadge status={event.status} />
          </div>
          <dl className="divide-y divide-line rounded-xl border border-line px-4">
            <KeyValue label="Endpoint"><span className="break-all font-mono text-xs">{event.targetUrl}</span></KeyValue>
            <KeyValue label="Attempts">{event.attempts}</KeyValue>
            <KeyValue label="Last attempt">{formatDate(event.lastAttemptAt)}</KeyValue>
            {event.lastResponseCode != null && <KeyValue label="Last response">HTTP {event.lastResponseCode}</KeyValue>}
            {event.deliveredAt && <KeyValue label="Delivered">{formatDate(event.deliveredAt)}</KeyValue>}
            {event.status === 'FAILED' && event.nextRetryAt && <KeyValue label="Next retry">{formatDate(event.nextRetryAt)}</KeyValue>}
          </dl>
          {event.lastResponseBody && event.status !== 'DELIVERED' && <Notice tone="bad">{event.lastResponseBody}</Notice>}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Payload</h3>
            <pre className="max-h-64 overflow-auto rounded-xl bg-raised p-4 font-mono text-xs leading-relaxed">
              {JSON.stringify(event.payload ?? {}, null, 2)}
            </pre>
          </section>
          {event.status !== 'PENDING' && (
            <Button loading={busy} onClick={replay}><Send className="h-4 w-4" /> Replay delivery</Button>
          )}
        </div>
      )}
    </Modal>
  )
}
