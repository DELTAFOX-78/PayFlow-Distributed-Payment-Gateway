import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Play } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { formatDate, formatMoney, PENDING_STATUSES, shortId } from '../lib/format'
import type { Page, Settlement } from '../lib/types'
import {
  Button, Card, CardHeader, CopyButton, Empty, KeyValue, Modal, Notice, PageHeader, Pager, Spinner, StatusBadge, useToast,
} from '../components/ui'

export default function Settlements() {
  const toast = useToast()
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<Settlement> | null>(null)
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState<string | null>(null)

  const load = useCallback(() => {
    api.listSettlements({ page, size: 15 })
      .then(setData)
      .catch((e: ApiError) => { toast(e.message, 'bad'); setData({ items: [], page: 0, size: 15, totalItems: 0, totalPages: 0 }) })
  }, [page, toast])
  useEffect(load, [load])

  // A transfer takes a few seconds to clear at the (simulated) bank.
  const inFlight = data?.items.some((s) => PENDING_STATUSES.includes(s.status))
  useEffect(() => {
    if (!inFlight) return
    const t = window.setInterval(load, 3000)
    return () => window.clearInterval(t)
  }, [inFlight, load])

  async function run() {
    setRunning(true); setNeedsSetup(null)
    try {
      const r = await api.runSettlement()
      toast(r.message, r.settled ? 'ok' : 'bad')
      load()
    } catch (e) {
      const err = e as ApiError
      if (err.code === 'SETTLEMENT_ACCOUNT_REQUIRED') setNeedsSetup(err.message)
      else toast(err.message ?? 'Settlement failed', 'bad')
    } finally { setRunning(false) }
  }

  return (
    <>
      <PageHeader
        title="Settlements"
        subtitle="Captured payments are paid out to your bank, less a 2% fee and 18% GST on the fee."
        action={<Button onClick={run} loading={running}><Play className="h-4 w-4" /> Run settlement now</Button>}
      />

      {needsSetup && (
        <div className="mb-5">
          <Notice tone="warn">
            {needsSetup} <Link to="/account" className="font-medium text-brand underline">Go to Account</Link>
          </Notice>
        </div>
      )}

      <Card>
        <CardHeader title="Payouts" hint="The nightly job runs at 23:00. Use the button to run it for your account on demand." />
        {data === null ? <Spinner /> : data.items.length === 0 ? (
          <Empty icon={<Banknote className="h-5 w-5" />} title="No settlements yet"
            hint="Capture a payment, then run a settlement to see it paid out." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">Settlement</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 text-right font-medium">Gross</th>
                  <th className="px-3 py-3 text-right font-medium">Fees + GST</th>
                  <th className="px-3 py-3 text-right font-medium">Net payout</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((s) => (
                  <tr key={s.id} onClick={() => setSelected(s.id)} className="cursor-pointer hover:bg-raised/50">
                    <td className="px-5 py-3.5 font-mono text-[13px]">{shortId(s.id)}</td>
                    <td className="px-3 py-3.5 text-muted">{formatDate(s.createdAt)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{formatMoney(s.grossAmount)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted">
                      {formatMoney({ amountUnits: s.feeAmount.amountUnits + s.gstAmount.amountUnits, currency: s.feeAmount.currency })}
                    </td>
                    <td className="px-3 py-3.5 text-right font-medium tabular-nums">{formatMoney(s.netAmount)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} onPage={setPage} />}
      </Card>

      <SettlementDetail id={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function SettlementDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const toast = useToast()
  const [s, setS] = useState<Settlement | null>(null)

  useEffect(() => {
    setS(null)
    if (id) api.getSettlement(id).then(setS).catch((e: ApiError) => toast(e.message, 'bad'))
  }, [id, toast])

  const row = (label: string, value: { amountUnits: number; currency: string }, sign = '') => (
    <KeyValue label={label}><span className="tabular-nums">{sign}{formatMoney(value)}</span></KeyValue>
  )

  return (
    <Modal open={!!id} onClose={onClose} title="Settlement breakdown">
      {!s ? <Spinner /> : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-semibold tabular-nums">{formatMoney(s.netAmount)}</span>
            <StatusBadge status={s.status} />
          </div>
          <dl className="divide-y divide-line rounded-xl border border-line px-4">
            {row('Gross captured', s.grossAmount)}
            {row('Refunds', s.refundAmount, '− ')}
            {row('Platform fee (2%)', s.feeAmount, '− ')}
            {row('GST on fee (18%)', s.gstAmount, '− ')}
            <KeyValue label="Net payout"><strong className="tabular-nums">{formatMoney(s.netAmount)}</strong></KeyValue>
          </dl>
          <dl className="divide-y divide-line rounded-xl border border-line px-4">
            <KeyValue label="Settlement ID"><span className="font-mono text-xs">{s.id}</span> <CopyButton value={s.id} label="" /></KeyValue>
            {s.bankReference && <KeyValue label="Bank reference"><span className="font-mono text-xs">{s.bankReference}</span></KeyValue>}
            <KeyValue label="Created">{formatDate(s.createdAt)}</KeyValue>
            {s.processedAt && <KeyValue label="Processed">{formatDate(s.processedAt)}</KeyValue>}
            <KeyValue label="Payments included">{s.paymentIds?.length ?? 0}</KeyValue>
          </dl>
          {s.failureReason && <Notice tone="bad">{s.failureReason}</Notice>}
        </div>
      )}
    </Modal>
  )
}
