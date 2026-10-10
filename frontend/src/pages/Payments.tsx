import { useMemo, useState, type FormEvent } from 'react'
import { Banknote, CreditCard, Landmark, Receipt, Smartphone, Trash2 } from 'lucide-react'
import { api, ApiError, session, type ApiKeyCredentials } from '../lib/api'
import { useAuth } from '../lib/auth'
import { clearActivity, loadActivity, recordOrder, recordPayment, type ActivityItem } from '../lib/activity'
import { formatDate, formatMoney, humanize, paymentTone, shortId } from '../lib/format'
import type { Payment, PaymentMethod } from '../lib/types'
import { Badge, Button, Card, CardHeader, CopyButton, Empty, Field, Input, Notice, PageHeader, Select, useToast } from '../components/ui'

const methods: { id: PaymentMethod; label: string; icon: typeof CreditCard }[] = [
  { id: 'CARD', label: 'Card', icon: CreditCard },
  { id: 'UPI', label: 'UPI', icon: Smartphone },
  { id: 'NETBANKING', label: 'Netbanking', icon: Landmark },
]

const testCards = [
  { pan: '4111111111111111', label: 'Visa · succeeds' },
  { pan: '4000000000000002', label: 'Declined' },
  { pan: '4000000000000069', label: 'Expired card' },
]

const banks = ['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK', 'BANK_CODE_FAIL']

export default function Payments() {
  const { merchantId } = useAuth()
  const toast = useToast()
  const [activity, setActivity] = useState<ActivityItem[]>(() => loadActivity(merchantId))
  const refresh = () => setActivity(loadActivity(merchantId))

  const [method, setMethod] = useState<PaymentMethod>('CARD')
  const [amount, setAmount] = useState('499.00')
  const [customer, setCustomer] = useState({ name: 'Test Customer', email: 'test@example.com', phone: '9999999999' })
  const [receipt, setReceipt] = useState('')
  const [card, setCard] = useState({ pan: '4111111111111111', cvv: '123', month: '12', year: String(new Date().getFullYear() + 3), holder: 'Test Customer' })
  const [vpa, setVpa] = useState('success@okaxis')
  const [bank, setBank] = useState('HDFC')

  const [useKey, setUseKey] = useState(() => !!session.apiKey)
  const [creds, setCreds] = useState<ApiKeyCredentials>(() => session.apiKey ?? { keyId: '', secret: '' })

  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [last, setLast] = useState<Payment | null>(null)

  const basic = useKey && creds.keyId && creds.secret ? creds : null
  const rows = useMemo(
    () => activity.flatMap(({ order, payments }) =>
      payments.length ? payments.map((p) => ({ order, p })) : [{ order, p: null as Payment | null }]),
    [activity],
  )

  async function pay(e: FormEvent) {
    e.preventDefault()
    if (!merchantId) return
    const units = Math.round(parseFloat(amount) * 100)
    if (!Number.isFinite(units) || units < 100) { setError(new ApiError(0, 'VALIDATION', 'Enter an amount of at least ₹1.00')); return }
    if (useKey) session.apiKey = creds

    setBusy(true); setError(null); setLast(null)
    try {
      setStep('Creating order…')
      const order = await api.createOrder({
        amount: { amountUnits: units, currency: 'INR' },
        receipt: receipt || undefined,
        customer,
      }, basic)
      recordOrder(merchantId, order)

      let methodDetails: Record<string, unknown>
      if (method === 'CARD') {
        setStep('Tokenizing card in the vault…')
        const tok = await api.tokenize({
          pan: card.pan.replace(/\s/g, ''), cvv: card.cvv,
          expiryMonth: Number(card.month), expiryYear: Number(card.year),
          cardHolderName: card.holder, customerId: order.customerId,
        }, basic)
        methodDetails = { token: tok.token }
      } else if (method === 'UPI') methodDetails = { vpa }
      else methodDetails = { bank }

      setStep('Authorizing payment…')
      const payment = await api.initiatePayment({ orderId: order.id, method, methodDetails }, basic)
      recordPayment(merchantId, payment)
      setLast(payment)
      toast(payment.status === 'FAILED' ? 'Payment failed' : 'Payment initiated', payment.status === 'FAILED' ? 'bad' : 'ok')
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'))
    } finally {
      setBusy(false); setStep(''); refresh()
    }
  }

  async function capture(p: Payment) {
    if (!merchantId) return
    try {
      recordPayment(merchantId, await api.capturePayment(p.id, basic))
      toast('Payment captured'); refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Capture failed', 'bad')
    }
  }

  const f = (k: keyof typeof card) => (e: { target: { value: string } }) => setCard((c) => ({ ...c, [k]: e.target.value }))

  return (
    <>
      <PageHeader title="Payments" subtitle="Run the full flow — order, tokenize, authorize — against the sandbox." />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Test checkout" hint="Creates a real order in the sandbox and attempts a payment." />
          <form onSubmit={pay} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount (INR)">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">₹</span>
                  <Input required inputMode="decimal" className="pl-7" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </Field>
              <Field label="Receipt" hint="Unique per merchant. Optional.">
                <Input maxLength={100} value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="order_rcpt_001" />
              </Field>
              <Field label="Customer name">
                <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </Field>
              <Field label="Customer email">
                <Input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
              </Field>
            </div>

            <div>
              <span className="mb-2 block text-xs font-medium text-muted">Payment method</span>
              <div className="grid grid-cols-3 gap-2">
                {methods.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id} type="button" onClick={() => setMethod(id)}
                    className={'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition ' +
                      (method === id ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:bg-raised')}
                  >
                    <Icon className="h-5 w-5" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {method === 'CARD' && (
              <div className="space-y-4 rounded-xl bg-raised/60 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {testCards.map((t) => (
                    <button key={t.pan} type="button" onClick={() => setCard({ ...card, pan: t.pan })}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted hover:text-ink">
                      {t.label}
                    </button>
                  ))}
                </div>
                <Field label="Card number">
                  <Input required inputMode="numeric" className="font-mono" value={card.pan} onChange={f('pan')} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Month"><Input required inputMode="numeric" maxLength={2} value={card.month} onChange={f('month')} /></Field>
                  <Field label="Year"><Input required inputMode="numeric" maxLength={4} value={card.year} onChange={f('year')} /></Field>
                  <Field label="CVV"><Input required type="password" inputMode="numeric" maxLength={4} value={card.cvv} onChange={f('cvv')} /></Field>
                </div>
                <Field label="Name on card"><Input minLength={3} value={card.holder} onChange={f('holder')} /></Field>
              </div>
            )}
            {method === 'UPI' && (
              <Field label="UPI ID" hint="Use fail@okaxis to simulate a failure.">
                <Input required value={vpa} onChange={(e) => setVpa(e.target.value)} />
              </Field>
            )}
            {method === 'NETBANKING' && (
              <Field label="Bank" hint="BANK_CODE_FAIL simulates a rejected transfer.">
                <Select value={bank} onChange={(e) => setBank(e.target.value)}>
                  {banks.map((b) => <option key={b}>{b}</option>)}
                </Select>
              </Field>
            )}

            <details className="rounded-xl border border-line px-4 py-3 text-sm" open={useKey}>
              <summary className="cursor-pointer text-xs font-medium text-muted">Authentication</summary>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useKey} onChange={(e) => setUseKey(e.target.checked)} className="accent-[rgb(var(--brand))]" />
                  Use an API key instead of my session
                </label>
                {useKey && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Key ID"><Input className="font-mono" value={creds.keyId} onChange={(e) => setCreds({ ...creds, keyId: e.target.value })} placeholder="rzp_test_…" /></Field>
                    <Field label="Key secret"><Input type="password" className="font-mono" value={creds.secret} onChange={(e) => setCreds({ ...creds, secret: e.target.value })} /></Field>
                  </div>
                )}
              </div>
            </details>

            {error && (
              <Notice tone="bad">
                <p className="font-medium">{error.code !== 'VALIDATION' && error.status ? `${error.status} · ` : ''}{error.message}</p>
                {error.fieldErrors.map((fe) => <p key={fe.field} className="text-xs">{fe.field}: {fe.message}</p>)}
              </Notice>
            )}

            <Button type="submit" loading={busy} className="w-full">
              {busy ? step : `Pay ${formatMoney({ amountUnits: Math.round((parseFloat(amount) || 0) * 100), currency: 'INR' })}`}
            </Button>
          </form>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Result" />
            {last ? (
              <div className="space-y-3 p-5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-semibold tabular-nums">{formatMoney(last.amount)}</span>
                  <Badge tone={paymentTone(last.status)}>{humanize(last.status)}</Badge>
                </div>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-muted">Payment</dt><dd className="font-mono">{last.id} <CopyButton value={last.id} label="" /></dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Order</dt><dd className="font-mono">{last.orderId}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Method</dt><dd>{humanize(last.method)}</dd></div>
                  {last.errorCode && <div className="flex justify-between gap-3"><dt className="text-muted">Error</dt><dd className="text-bad">{last.errorCode}</dd></div>}
                  {last.errorDescription && <p className="text-bad">{last.errorDescription}</p>}
                </dl>
                {last.status === 'AUTHORIZING' && (
                  <Notice tone="brand">
                    The bank simulator resolves this within a few seconds. There's no read endpoint yet, so the final
                    status arrives via your webhook.
                  </Notice>
                )}
              </div>
            ) : (
              <Empty icon={<Banknote className="h-5 w-5" />} title="Nothing yet" hint="Submit the checkout to see the payment outcome." />
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Activity"
          hint="Stored in this browser only — the API has no list endpoint yet."
          action={activity.length > 0 && merchantId ? (
            <Button size="sm" variant="ghost" onClick={() => { clearActivity(merchantId); refresh() }}><Trash2 className="h-3.5 w-3.5" /> Clear</Button>
          ) : undefined}
        />
        {rows.length === 0 ? (
          <Empty icon={<Receipt className="h-5 w-5" />} title="No activity" hint="Orders and payments you create here are listed below." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-3 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Method</th>
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 25).map(({ order, p }) => (
                  <tr key={p?.id ?? order.id} className="hover:bg-raised/40">
                    <td className="px-5 py-3 text-muted">{formatDate(p?.createdAt ?? order.createdAt)}</td>
                    <td className="px-3 py-3"><code className="font-mono text-xs">{order.receipt || shortId(order.id)}</code></td>
                    <td className="px-3 py-3">{p ? humanize(p.method) : '—'}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{formatMoney(order.amount)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={paymentTone(p?.status ?? order.status)}>{humanize(p?.status ?? order.status)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p?.status === 'AUTHORIZED' && <Button size="sm" variant="secondary" onClick={() => capture(p)}>Capture</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
