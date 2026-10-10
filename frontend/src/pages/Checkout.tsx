import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react'
import { api, ApiError, session, type ApiKeyCredentials } from '../lib/api'
import { formatMoney, formatUnits, rupeesToUnits } from '../lib/format'
import type { Payment, PaymentMethod } from '../lib/types'
import {
  Button, Card, CardHeader, CopyButton, Empty, Field, Input, Notice, PageHeader, Select, StatusBadge, useToast,
} from '../components/ui'

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
const TERMINAL = ['CAPTURED', 'FAILED', 'CANCELLED', 'AUTH_EXPIRED', 'SETTLED', 'REFUNDED']

export default function Checkout() {
  const toast = useToast()

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
  const [result, setResult] = useState<Payment | null>(null)
  const poll = useRef<number | null>(null)

  const basic = useKey && creds.keyId && creds.secret ? creds : null
  useEffect(() => () => { if (poll.current) window.clearInterval(poll.current) }, [])

  /** The bank answers asynchronously, so keep refreshing until the payment settles into a final state. */
  function watch(id: string) {
    if (poll.current) window.clearInterval(poll.current)
    let tries = 0
    poll.current = window.setInterval(async () => {
      tries++
      try {
        const p = await api.getPayment(id, basic)
        setResult(p)
        if (TERMINAL.includes(p.status) || tries > 30) {
          if (poll.current) window.clearInterval(poll.current)
          if (p.status === 'CAPTURED') toast('Payment captured')
        }
      } catch { if (poll.current) window.clearInterval(poll.current) }
    }, 1500)
  }

  async function pay(e: FormEvent) {
    e.preventDefault()
    const units = rupeesToUnits(amount)
    if (units == null || units < 100) { setError(new ApiError(0, 'VALIDATION', 'Enter an amount of at least ₹1.00')); return }
    if (useKey) session.apiKey = creds

    setBusy(true); setError(null); setResult(null)
    try {
      setStep('Creating order…')
      const order = await api.createOrder({
        amount: { amountUnits: units, currency: 'INR' },
        receipt: receipt || undefined,
        customer,
      }, basic)

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
      setResult(payment)
      if (!TERMINAL.includes(payment.status)) watch(payment.id)
      else if (payment.status === 'FAILED') toast('Payment failed', 'bad')
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Something went wrong'))
    } finally {
      setBusy(false); setStep('')
    }
  }

  const f = (k: keyof typeof card) => (e: { target: { value: string } }) => setCard((c) => ({ ...c, [k]: e.target.value }))
  const units = rupeesToUnits(amount) ?? 0

  return (
    <>
      <PageHeader
        title="Test checkout"
        subtitle="Run the full flow (order, tokenize, authorize, capture) against the sandbox."
        action={<Link to="/payments"><Button variant="secondary">All payments</Button></Link>}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Payment details" hint="Creates a real order in the sandbox and attempts a payment." />
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
              {busy ? step : `Pay ${formatUnits(units)}`}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2 self-start">
          <CardHeader title="Result" hint="Updates live while the bank responds." />
          {result ? (
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold tabular-nums">{formatMoney(result.amount)}</span>
                <StatusBadge status={result.status} />
              </div>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-muted">Payment</dt><dd className="font-mono">{result.id.slice(0, 18)}… <CopyButton value={result.id} label="" /></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Method</dt><dd>{result.method}</dd></div>
                {result.bankReference && <div className="flex justify-between gap-3"><dt className="text-muted">Bank ref</dt><dd className="font-mono">{result.bankReference}</dd></div>}
                {result.errorCode && <div className="flex justify-between gap-3"><dt className="text-muted">Error</dt><dd className="text-bad">{result.errorCode}</dd></div>}
                {result.errorDescription && <p className="text-bad">{result.errorDescription}</p>}
              </dl>
              {!TERMINAL.includes(result.status) && (
                <Notice tone="brand">Waiting for the bank to respond…</Notice>
              )}
              {result.status === 'CAPTURED' && (
                <Link to="/payments"><Button variant="secondary" className="w-full">View in payments</Button></Link>
              )}
            </div>
          ) : (
            <Empty icon={<Banknote className="h-5 w-5" />} title="Nothing yet" hint="Submit the checkout to see the payment outcome." />
          )}
        </Card>
      </div>
    </>
  )
}
