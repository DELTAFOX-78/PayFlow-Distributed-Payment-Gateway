import type { Money } from './types'

export const formatMoney = (m?: Money | null) =>
  m
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: m.currency || 'INR' }).format(m.amountUnits / 100)
    : '—'

export const formatUnits = (units?: number | null, currency = 'INR') =>
  formatMoney(units == null ? null : { amountUnits: units, currency })

export const formatDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

export const shortId = (id?: string) => (id ? id.slice(0, 8) : '—')

export const humanize = (s: string) =>
  s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'brand'

/** One status vocabulary across payments, orders, refunds, settlements and webhook deliveries. */
export const statusTone = (s: string): Tone => {
  switch (s) {
    case 'CAPTURED': case 'SETTLED': case 'PAID': case 'PROCESSED': case 'DELIVERED': case 'ACTIVE':
      return 'ok'
    case 'FAILED': case 'CANCELLED': case 'AUTH_EXPIRED': case 'DEAD': case 'SUSPENDED':
      return 'bad'
    case 'AUTHORIZING': case 'CAPTURING': case 'ATTEMPTED': case 'PENDING': case 'PROCESSING':
    case 'TRANSFER_PENDING': case 'INITIATED': case 'PENDING_KYC': case 'PARTIALLY_REFUNDED':
      return 'warn'
    case 'AUTHORIZED': case 'REFUNDED':
      return 'brand'
    default:
      return 'neutral'
  }
}

/** Convert a rupee string such as "499.50" to paise, or null when it is not a valid amount. */
export const rupeesToUnits = (value: string): number | null => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

export const PENDING_STATUSES = ['AUTHORIZING', 'CAPTURING', 'TRANSFER_PENDING', 'INITIATED']
