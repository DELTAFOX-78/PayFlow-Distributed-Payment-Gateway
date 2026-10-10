import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Plus, RotateCcw } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { formatDate, formatMoney, formatUnits, humanize, PENDING_STATUSES, rupeesToUnits, shortId } from '../lib/format'
import type { Page, Payment, PaymentMethod, PaymentStatus, PaymentTransition, Refund } from '../lib/types'
import {
  Button, Card, CopyButton, Empty, Field, Input, KeyValue, Modal, Notice, PageHeader, Pager, Select, Spinner,
  StatusBadge, useToast,
} from '../components/ui'

const STATUSES: PaymentStatus[] = [
  'AUTHORIZING', 'AUTHORIZED', 'CAPTURED', 'SETTLED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'CANCELLED',
]
const METHODS: PaymentMethod[] = ['CARD', 'UPI', 'NETBANKING']

export default function Payments() {
  const toast = useToast()
  const [status, setStatus] = useState<PaymentStatus | ''>('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<Payment> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(() => {
    api.listPayments({ status: status || undefined, method: method || undefined, page, size: 15 })
      .then(setData)
      .catch((e: ApiError) => { toast(e.message, 'bad'); setData({ items: [], page: 0, size: 15, totalItems: 0, totalPages: 0 }) })
  }, [status, method, page, toast])

  useEffect(load, [load])

  // The bank answers asynchronously: keep the list fresh while anything is still in flight.
  const inFlight = data?.items.some((p) => PENDING_STATUSES.includes(p.status))
  useEffect(() => {
    if (!inFlight) return
    const t = window.setInterval(load, 3000)
    return () => window.clearInterval(t)
  }, [inFlight, load])

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Every payment attempt, with its full lifecycle and refunds."
        action={<Link to="/payments/new"><Button><Plus className="h-4 w-4" /> New test payment</Button></Link>}
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <div className="w-44">
            <Field label="Status">
              <Select value={status} onChange={(e) => { setStatus(e.target.value as PaymentStatus | ''); setPage(0) }}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </Field>
          </div>
          <div className="w-40">
            <Field label="Method">
              <Select value={method} onChange={(e) => { setMethod(e.target.value as PaymentMethod | ''); setPage(0) }}>
                <option value="">All methods</option>
                {METHODS.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
              </Select>
            </Field>
          </div>
          {inFlight && <span className="pb-2.5 text-xs text-muted">Refreshing while payments are in flight…</span>}
        </div>

        {data === null ? <Spinner /> : data.items.length === 0 ? (
          <Empty
            icon={<CreditCard className="h-5 w-5" />}
            title="No payments found"
            hint={status || method ? 'Try clearing the filters.' : 'Run a test payment to see it here.'}
            action={<Link to="/payments/new"><Button size="sm">New test payment</Button></Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                  <th className="px-3 py-3 text-right font-medium">Refunded</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((p) => (
                  <tr key={p.id} onClick={() => setSelected(p.id)} className="cursor-pointer hover:bg-raised/50">
                    <td className="px-5 py-3.5 font-mono text-[13px]">{shortId(p.id)}</td>
                    <td className="px-3 py-3.5 text-muted">{formatDate(p.createdAt)}</td>
                    <td className="px-3 py-3.5">{humanize(p.method)}</td>
                    <td className="px-3 py-3.5 text-right font-medium tabular-nums">{formatMoney(p.amount)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted">
                      {p.refundedAmountUnits ? formatUnits(p.refundedAmountUnits, p.amount.currency) : '—'}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} onPage={setPage} />}
      </Card>

      <PaymentDetail id={selected} onClose={() => setSelected(null)} onChanged={load} />
    </>
  )
}

function PaymentDetail({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [timeline, setTimeline] = useState<PaymentTransition[]>([])
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (paymentId: string) => {
    const [p, t, r] = await Promise.all([
      api.getPayment(paymentId), api.paymentTimeline(paymentId), api.listPaymentRefunds(paymentId),
    ])
    setPayment(p); setTimeline(t); setRefunds(r)
  }, [])

  useEffect(() => {
    setPayment(null); setTimeline([]); setRefunds([]); setAmount(''); setError(null)
    if (id) load(id).catch((e: ApiError) => toast(e.message, 'bad'))
  }, [id, load, toast])

  const refundable = payment
    ? payment.amount.amountUnits - (payment.refundedAmountUnits ?? 0)
    : 0
  const canRefund = !!payment && ['CAPTURED', 'SETTLED', 'PARTIALLY_REFUNDED'].includes(payment.status) && refundable > 0

  async function refund(full: boolean) {
    if (!payment) return
    let units: number | undefined
    if (!full) {
      const parsed = rupeesToUnits(amount)
      if (parsed == null) { setError('Enter an amount greater than zero'); return }
      units = parsed
    }
    setBusy(true); setError(null)
    try {
      await api.refund(payment.id, units)
      toast(full ? 'Refunded in full' : 'Refund created')
      setAmount('')
      await load(payment.id)
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Refund failed')
    } finally { setBusy(false) }
  }

  async function capture() {
    if (!payment) return
    setBusy(true)
    try { await api.capturePayment(payment.id); await load(payment.id); onChanged() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Capture failed') }
    finally { setBusy(false) }
  }

  return (
    <Modal open={!!id} onClose={onClose} title="Payment details" size="lg">
      {!payment ? <Spinner /> : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-semibold tabular-nums">{formatMoney(payment.amount)}</span>
            <StatusBadge status={payment.status} />
          </div>

          <dl className="divide-y divide-line rounded-xl border border-line px-4">
            <KeyValue label="Payment ID"><span className="font-mono text-xs">{payment.id}</span> <CopyButton value={payment.id} label="" /></KeyValue>
            <KeyValue label="Order ID"><span className="font-mono text-xs">{payment.orderId}</span></KeyValue>
            <KeyValue label="Method">{humanize(payment.method)}</KeyValue>
            <KeyValue label="Created">{formatDate(payment.createdAt)}</KeyValue>
            {payment.capturedAt && <KeyValue label="Captured">{formatDate(payment.capturedAt)}</KeyValue>}
            {payment.settledAt && <KeyValue label="Settled">{formatDate(payment.settledAt)}</KeyValue>}
            {payment.bankReference && <KeyValue label="Bank reference"><span className="font-mono text-xs">{payment.bankReference}</span></KeyValue>}
            {!!payment.refundedAmountUnits && (
              <KeyValue label="Refunded">{formatUnits(payment.refundedAmountUnits, payment.amount.currency)}</KeyValue>
            )}
            {payment.errorCode && <KeyValue label="Error"><span className="text-bad">{payment.errorCode}</span></KeyValue>}
          </dl>
          {payment.errorDescription && <Notice tone="bad">{payment.errorDescription}</Notice>}

          <section>
            <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-surface" />
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{humanize(t.event)}</span>
                    <span className="text-xs text-muted">{t.fromStatus ? `${humanize(t.fromStatus)} → ` : ''}{humanize(t.toStatus)}</span>
                  </div>
                  <p className="text-xs text-muted">{formatDate(t.occurredAt)}{t.actor ? ` · ${humanize(t.actor)}` : ''}</p>
                </li>
              ))}
              {timeline.length === 0 && <li className="text-sm text-muted">No transitions recorded.</li>}
            </ol>
          </section>

          {refunds.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Refunds</h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium tabular-nums">{formatMoney(r.amount)}</p>
                      <p className="text-xs text-muted">{formatDate(r.createdAt)}{r.bankReference ? ` · ${r.bankReference}` : ''}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {payment.status === 'AUTHORIZED' && (
            <Button loading={busy} onClick={capture}>Capture payment</Button>
          )}

          {canRefund && (
            <section className="rounded-xl bg-raised/60 p-4">
              <h3 className="text-sm font-semibold">Refund</h3>
              <p className="mb-3 text-xs text-muted">Refundable balance: {formatUnits(refundable, payment.amount.currency)}</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <Field label="Amount (INR)">
                    <Input inputMode="decimal" placeholder="e.g. 100.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Field>
                </div>
                <Button variant="secondary" loading={busy} disabled={!amount} onClick={() => refund(false)}>
                  <RotateCcw className="h-4 w-4" /> Partial refund
                </Button>
                <Button variant="danger" loading={busy} onClick={() => refund(true)}>Refund full balance</Button>
              </div>
              {error && <p className="mt-2 text-xs text-bad">{error}</p>}
            </section>
          )}
          {!canRefund && error && <Notice tone="bad">{error}</Notice>}
        </div>
      )}
    </Modal>
  )
}
