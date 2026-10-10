import type { Order, Payment } from './types'

// The backend has no list/read endpoints for orders or payments yet, so the
// dashboard keeps what this browser created, per merchant, in localStorage.
export interface ActivityItem { order: Order; payments: Payment[] }

const key = (merchantId: string) => `rzp.activity.${merchantId}`

export function loadActivity(merchantId?: string): ActivityItem[] {
  if (!merchantId) return []
  try { return JSON.parse(localStorage.getItem(key(merchantId)) ?? '[]') } catch { return [] }
}

function save(merchantId: string, items: ActivityItem[]) {
  try { localStorage.setItem(key(merchantId), JSON.stringify(items.slice(0, 200))) } catch { /* ignore */ }
}

export function recordOrder(merchantId: string, order: Order) {
  save(merchantId, [{ order, payments: [] }, ...loadActivity(merchantId)])
}

export function recordPayment(merchantId: string, payment: Payment) {
  const items = loadActivity(merchantId)
  const item = items.find((i) => i.order.id === payment.orderId)
  if (!item) return
  const idx = item.payments.findIndex((p) => p.id === payment.id)
  if (idx >= 0) item.payments[idx] = payment
  else item.payments.unshift(payment)
  if (payment.status === 'CAPTURED' || payment.status === 'SETTLED') item.order.status = 'PAID'
  else if (item.order.status === 'CREATED') item.order.status = 'ATTEMPTED'
  save(merchantId, items)
}

export function clearActivity(merchantId: string) {
  try { localStorage.removeItem(key(merchantId)) } catch { /* ignore */ }
}
