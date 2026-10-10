import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Check, CircleDashed, IndianRupee, Percent, Receipt, Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import { formatDate, formatUnits, shortId } from '../lib/format'
import type { MerchantProfile, Payment, Page } from '../lib/types'
import { Button, Card, CardHeader, Empty, PageHeader, StatusBadge } from '../components/ui'

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  )
}

export default function Overview() {
  const [profile, setProfile] = useState<MerchantProfile | null>(null)
  const [payments, setPayments] = useState<Page<Payment> | null>(null)
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const [keys, setKeys] = useState(0)
  const [hooks, setHooks] = useState(0)
  const [settlements, setSettlements] = useState(0)

  useEffect(() => {
    api.me().then(setProfile).catch(() => {})
    api.listPayments({ size: 100 }).then(setPayments).catch(() => setPayments({ items: [], page: 0, size: 100, totalItems: 0, totalPages: 0 }))
    api.listOrders({ size: 1 }).then((p) => setOrderCount(p.totalItems)).catch(() => setOrderCount(0))
    api.listKeys().then((k) => setKeys(k.length)).catch(() => {})
    api.listWebhooks().then((w) => setHooks(w.length)).catch(() => {})
    api.listSettlements({ size: 1 }).then((s) => setSettlements(s.totalItems)).catch(() => {})
  }, [])

  const items = payments?.items ?? []
  const successful = items.filter((p) => ['CAPTURED', 'SETTLED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status))
  const finished = items.filter((p) => !['CREATED', 'AUTHORIZING', 'CAPTURING'].includes(p.status))
  const volume = successful.reduce((s, p) => s + p.amount.amountUnits, 0)
  const refunded = items.reduce((s, p) => s + (p.refundedAmountUnits ?? 0), 0)
  const rate = finished.length ? Math.round((successful.length / finished.length) * 100) : null

  const steps = [
    { done: !!profile?.settlementAccountConfigured, title: 'Add a settlement account', hint: 'Where your payouts are sent.', to: '/account' },
    { done: !!profile?.kycComplete, title: 'Complete KYC', hint: 'Activates your account for settlements.', to: '/account' },
    { done: keys > 0, title: 'Generate an API key', hint: 'Authenticate server-to-server calls.', to: '/api-keys' },
    { done: hooks > 0, title: 'Add a webhook endpoint', hint: 'Get notified when payments change state.', to: '/webhooks' },
    { done: (payments?.totalItems ?? 0) > 0, title: 'Run a test payment', hint: 'Create an order and pay with a test card.', to: '/payments/new' },
    { done: settlements > 0, title: 'Run your first settlement', hint: 'Pay out captured payments to your bank.', to: '/settlements' },
  ]

  return (
    <>
      <PageHeader
        title={profile ? `Welcome, ${profile.name.split(' ')[0]}` : 'Overview'}
        subtitle="Your sandbox at a glance."
        action={<Link to="/payments/new"><Button>New test payment <ArrowRight className="h-4 w-4" /></Button></Link>}
      />

      {profile && profile.merchantStatus !== 'ACTIVE' && (
        <Link to="/account" className="mb-6 flex items-center gap-3 rounded-xl bg-warn/10 px-4 py-3 text-sm transition hover:bg-warn/15">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" />
          <span className="flex-1">
            <strong>Your account is not active yet.</strong> Add a settlement account and complete KYC to enable settlements.
          </span>
          <ArrowRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={IndianRupee} label="Captured volume" value={formatUnits(volume)} hint={`${formatUnits(refunded)} refunded`} />
        <Stat icon={Receipt} label="Orders" value={orderCount == null ? '…' : String(orderCount)} />
        <Stat icon={Wallet} label="Payments" value={payments == null ? '…' : String(payments.totalItems)} hint="latest 100 used for volume" />
        <Stat icon={Percent} label="Success rate" value={rate == null ? '—' : `${rate}%`} hint="of completed attempts" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Recent payments" action={<Link to="/payments" className="text-xs font-medium text-brand hover:underline">View all</Link>} />
          {items.length === 0 ? (
            <Empty
              icon={<Receipt className="h-5 w-5" />}
              title="No payments yet"
              hint="Run a test payment to see it show up here."
              action={<Link to="/payments/new"><Button size="sm">Create test payment</Button></Link>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {items.slice(0, 7).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{shortId(p.id)}</p>
                    <p className="text-xs text-muted">{formatDate(p.createdAt)} · {p.method.toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium tabular-nums">{formatUnits(p.amount.amountUnits, p.amount.currency)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Get started" hint={`${steps.filter((s) => s.done).length} of ${steps.length} complete`} />
          <ul className="divide-y divide-line">
            {steps.map((s) => (
              <li key={s.title}>
                <Link to={s.to} className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-raised/60">
                  <span className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full ' + (s.done ? 'bg-ok/15 text-ok' : 'bg-raised text-muted')}>
                    {s.done ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={'text-sm font-medium ' + (s.done ? 'text-muted line-through' : '')}>{s.title}</p>
                    <p className="text-xs text-muted">{s.hint}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
