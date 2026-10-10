import type { Money, PaymentStatus, OrderStatus } from './types'

export const formatMoney = (m?: Money | null) =>
  m
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: m.currency || 'INR' }).format(m.amountUnits / 100)
    : '—'

export const formatDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

export const shortId = (id?: string) => (id ? id.slice(0, 8) : '—')

export const humanize = (s: string) =>
  s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'brand'

export const paymentTone = (s: PaymentStatus | OrderStatus): Tone => {
  switch (s) {
    case 'CAPTURED': case 'SETTLED': case 'PAID': return 'ok'
    case 'FAILED': case 'CANCELLED': case 'AUTH_EXPIRED': return 'bad'
    case 'AUTHORIZING': case 'CAPTURING': case 'ATTEMPTED': return 'warn'
    case 'AUTHORIZED': return 'brand'
    default: return 'neutral'
  }
}
