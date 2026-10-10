import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CircleDashed, IndianRupee, Percent, Receipt, Wallet } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { loadActivity } from '../lib/activity'
import { formatDate, formatMoney, humanize, paymentTone, shortId } from '../lib/format'
import { Badge, Button, Card, CardHeader, Empty, PageHeader } from '../components/ui'

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
  const { merchantId } = useAuth()
  const activity = useMemo(() => loadActivity(merchantId), [merchantId])
  const [keys, setKeys] = useState<number | null>(null)
  const [hooks, setHooks] = useState<number | null>(null)

  useEffect(() => {
    api.listKeys().then((k) => setKeys(k.length)).catch(() => setKeys(0))
    api.listWebhooks().then((w) => setHooks(w.length)).catch(() => setHooks(0))
  }, [])

  const payments = activity.flatMap((a) => a.payments)
  const captured = payments.filter((p) => p.status === 'CAPTURED' || p.status === 'SETTLED')
  const volume = captured.reduce((s, p) => s + p.amount.amountUnits, 0)
  const rate = payments.length ? Math.round((captured.length / payments.length) * 100) : 0

  const steps = [
    { done: (keys ?? 0) > 0, title: 'Generate an API key', hint: 'Authenticate server-to-server calls.', to: '/api-keys' },
    { done: (hooks ?? 0) > 0, title: 'Add a webhook endpoint', hint: 'Get notified when payments change state.', to: '/webhooks' },
    { done: payments.length > 0, title: 'Run a test payment', hint: 'Create an order and pay with a test card.', to: '/payments' },
  ]

  const recent = activity.slice(0, 6)

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Your sandbox at a glance."
        action={<Link to="/payments"><Button>New test payment <ArrowRight className="h-4 w-4" /></Button></Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={IndianRupee} label="Captured volume" value={formatMoney({ amountUnits: volume, currency: 'INR' })} hint="From this browser's activity" />
        <Stat icon={Receipt} label="Orders created" value={String(activity.length)} />
        <Stat icon={Wallet} label="Payments attempted" value={String(payments.length)} />
        <Stat icon={Percent} label="Success rate" value={payments.length ? `${rate}%` : '—'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Recent orders" hint="Orders created from this console" action={<Link to="/payments" className="text-xs font-medium text-brand hover:underline">View all</Link>} />
          {recent.length === 0 ? (
            <Empty
              icon={<Receipt className="h-5 w-5" />}
              title="No orders yet"
              hint="Run a test payment to see it show up here."
              action={<Link to="/payments"><Button size="sm">Create test order</Button></Link>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map(({ order, payments: ps }) => (
                <li key={order.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.receipt || `Order ${shortId(order.id)}`}</p>
                    <p className="text-xs text-muted">{formatDate(order.createdAt)} · {ps.length} attempt{ps.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium tabular-nums">{formatMoney(order.amount)}</span>
                    <Badge tone={paymentTone(order.status)}>{humanize(order.status)}</Badge>
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
                <Link to={s.to} className="flex items-center gap-3.5 px-5 py-4 transition hover:bg-raised/60">
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
