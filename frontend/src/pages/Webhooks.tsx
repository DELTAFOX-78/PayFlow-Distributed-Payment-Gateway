import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, Webhook as WebhookIcon } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { WebhookConfig } from '../lib/types'
import {
  Badge, Button, Card, CopyButton, Empty, Field, Input, Modal, Notice, PageHeader, Spinner, useToast,
} from '../components/ui'

const EVENTS = [
  { id: 'PAYMENT_CREATED', label: 'Payment created' },
  { id: 'PAYMENT_STATUS_CHANGED', label: 'Payment status changed' },
  { id: 'PAYMENT_AUTHORIZATION_COMPENSATED', label: 'Authorization compensated' },
  { id: 'REFUND_CREATED', label: 'Refund created' },
  { id: 'SETTLEMENT_PROCESSED', label: 'Settlement processed' },
]

interface Draft { id?: string; targetUrl: string; events: string[]; all: boolean }
const blank: Draft = { targetUrl: '', events: [], all: true }

export default function Webhooks() {
  const toast = useToast()
  const [hooks, setHooks] = useState<WebhookConfig[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<WebhookConfig | null>(null)

  const load = useCallback(() => {
    api.listWebhooks().then(setHooks).catch((e: ApiError) => { setHooks([]); toast(e.message, 'bad') })
  }, [toast])
  useEffect(load, [load])

  function edit(h: WebhookConfig) {
    const t = (h.eventTypes ?? '').trim()
    const all = !t || t.toUpperCase() === 'ALL'
    setDraft({ id: h.id, targetUrl: h.targetUrl, all, events: all ? [] : t.split(',').map((s) => s.trim()) })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    const body = { targetUrl: draft.targetUrl, eventTypes: draft.all ? 'ALL' : draft.events.join(',') }
    try {
      if (draft.id) { await api.updateWebhook(draft.id, body); toast('Webhook updated') }
      else { setCreated(await api.createWebhook(body)) }
      setDraft(null); load()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Request failed', 'bad')
    } finally { setBusy(false) }
  }

  async function remove(h: WebhookConfig) {
    if (!confirm(`Delete the webhook for ${h.targetUrl}?`)) return
    try { await api.deleteWebhook(h.id); toast('Webhook deleted'); load() }
    catch (err) { toast(err instanceof ApiError ? err.message : 'Request failed', 'bad') }
  }

  const toggle = (id: string) =>
    setDraft((d) => d && { ...d, events: d.events.includes(id) ? d.events.filter((x) => x !== id) : [...d.events, id] })

  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="We POST signed event payloads to your endpoint, with automatic retries for up to 7 attempts."
        action={<Button onClick={() => setDraft(blank)}><Plus className="h-4 w-4" /> Add endpoint</Button>}
      />

      {hooks === null ? <Card><Spinner /></Card> : hooks.length === 0 ? (
        <Card>
          <Empty
            icon={<WebhookIcon className="h-5 w-5" />}
            title="No webhook endpoints"
            hint="Add an HTTPS endpoint to receive payment and settlement events."
            action={<Button size="sm" onClick={() => setDraft(blank)}>Add endpoint</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {hooks.map((h) => (
            <Card key={h.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-sm font-medium">{h.targetUrl}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={h.enabled ? 'ok' : 'bad'}>{h.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    {(!h.eventTypes || h.eventTypes.toUpperCase() === 'ALL')
                      ? <Badge tone="brand">All events</Badge>
                      : h.eventTypes.split(',').map((t) => <Badge key={t}>{t.trim()}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => edit(h)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => remove(h)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit endpoint' : 'Add endpoint'}>
        {draft && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Endpoint URL" hint="Must start with http:// or https://">
              <Input
                required type="url" placeholder="https://example.com/webhooks/razorpay"
                value={draft.targetUrl} onChange={(e) => setDraft({ ...draft, targetUrl: e.target.value })}
              />
            </Field>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-muted">Events</span>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.all} onChange={(e) => setDraft({ ...draft, all: e.target.checked })} className="accent-[rgb(var(--brand))]" />
                Subscribe to all events
              </label>
              {!draft.all && (
                <div className="space-y-1.5 rounded-lg bg-raised p-3">
                  {EVENTS.map((ev) => (
                    <label key={ev.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.events.includes(ev.id)} onChange={() => toggle(ev.id)} className="accent-[rgb(var(--brand))]" />
                      <span>{ev.label}</span><code className="ml-auto font-mono text-[11px] text-muted">{ev.id}</code>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" loading={busy} disabled={!draft.all && draft.events.length === 0}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Endpoint added">
        {created && (
          <div className="space-y-4">
            <Notice tone="brand">Use this signing secret to verify the <code className="font-mono">X-Razorpay-Signature</code> header (HMAC-SHA256).</Notice>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-raised px-3 py-2">
              <code className="break-all font-mono text-[13px]">{created.webhookSecret ?? 'Secret not returned'}</code>
              {created.webhookSecret && <CopyButton value={created.webhookSecret} />}
            </div>
            <div className="flex justify-end"><Button onClick={() => setCreated(null)}>Done</Button></div>
          </div>
        )}
      </Modal>
    </>
  )
}
