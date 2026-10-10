import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Receipt } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { formatDate, formatMoney, humanize, shortId } from '../lib/format'
import type { Order, OrderStatus, Page } from '../lib/types'
import { Button, Card, Empty, Field, PageHeader, Pager, Select, Spinner, StatusBadge, useToast } from '../components/ui'

const STATUSES: OrderStatus[] = ['CREATED', 'ATTEMPTED', 'PAID', 'CANCELLED']

export default function Orders() {
  const toast = useToast()
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<Order> | null>(null)

  const load = useCallback(() => {
    api.listOrders({ status: status || undefined, page, size: 15 })
      .then(setData)
      .catch((e: ApiError) => { toast(e.message, 'bad'); setData({ items: [], page: 0, size: 15, totalItems: 0, totalPages: 0 }) })
  }, [status, page, toast])
  useEffect(load, [load])

  async function cancel(o: Order) {
    if (!confirm(`Cancel order ${o.receipt ?? shortId(o.id)}? It can no longer be paid.`)) return
    try { await api.cancelOrder(o.id); toast('Order cancelled'); load() }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Could not cancel', 'bad') }
  }

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="An order is the amount you intend to collect; payments are attempts against it."
        action={<Link to="/payments/new"><Button><Plus className="h-4 w-4" /> New order</Button></Link>}
      />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <div className="w-48">
            <Field label="Status">
              <Select value={status} onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPage(0) }}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        {data === null ? <Spinner /> : data.items.length === 0 ? (
          <Empty icon={<Receipt className="h-5 w-5" />} title="No orders found"
            hint={status ? 'Try clearing the filter.' : 'Orders are created at checkout.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">Receipt</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                  <th className="px-3 py-3 text-right font-medium">Attempts</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((o) => (
                  <tr key={o.id} className="hover:bg-raised/50">
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-[13px]">{o.receipt ?? '—'}</p>
                      <p className="text-xs text-muted">{shortId(o.id)}</p>
                    </td>
                    <td className="px-3 py-3.5 text-muted">{formatDate(o.createdAt)}</td>
                    <td className="px-3 py-3.5 text-right font-medium tabular-nums">{formatMoney(o.amount)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{o.attempts}</td>
                    <td className="px-3 py-3.5"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      {(o.status === 'CREATED' || o.status === 'ATTEMPTED') && (
                        <Button size="sm" variant="danger" onClick={() => cancel(o)}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} onPage={setPage} />}
      </Card>
    </>
  )
}
