import type {
  ApiKey, ApiKeyCreated, BusinessType, Environment, MerchantProfile, MerchantResponse, Order, OrderStatus,
  Page, Payment, PaymentMethod, PaymentStatus, PaymentTransition, Refund, RunSettlementResult, Settlement,
  TokenizeResponse, WebhookConfig, WebhookEvent, WebhookEventStatus,
} from './types'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'
const TOKEN_KEY = 'rzp.token'
const KEY_KEY = 'rzp.apikey'

export interface ApiKeyCredentials { keyId: string; secret: string }

export const session = {
  get token(): string | null {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set token(v: string | null) {
    try { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
  },
  get apiKey(): ApiKeyCredentials | null {
    try { return JSON.parse(sessionStorage.getItem(KEY_KEY) ?? 'null') } catch { return null }
  },
  set apiKey(v: ApiKeyCredentials | null) {
    try { if (v) sessionStorage.setItem(KEY_KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY_KEY) } catch { /* ignore */ }
  },
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: { field: string; message: string }[] = [],
  ) { super(message) }
}

interface ReqOpts {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  /** Use API-key (Basic) auth instead of the session JWT. */
  basic?: ApiKeyCredentials | null
  anonymous?: boolean
}

async function request<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (!opts.anonymous) {
    if (opts.basic) headers.Authorization = `Basic ${btoa(`${opts.basic.keyId}:${opts.basic.secret}`)}`
    else if (session.token) headers.Authorization = `Bearer ${session.token}`
  }

  let res: Response
  try {
    res = await fetch(BASE + path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the API gateway. Is it running on :8080?')
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { /* non-JSON body */ }

  if (!res.ok) {
    if (res.status === 401 && !opts.anonymous && !opts.basic) {
      window.dispatchEvent(new Event('rzp:unauthorized'))
    }
    throw new ApiError(
      res.status,
      data?.errorCode ?? `HTTP_${res.status}`,
      data?.errorDescription ?? data?.message ?? (res.statusText || 'Request failed'),
      data?.fieldErrors ?? [],
    )
  }
  return data as T
}

function qs(params: Record<string, string | number | undefined | null>) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return entries.length ? '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString() : ''
}

export const api = {
  // --- auth
  signup: (b: { name: string; email: string; password: string; businessName?: string; businessType?: BusinessType }) =>
    request<MerchantResponse>('/v1/auth/signup', { body: b, anonymous: true }),
  login: (b: { email: string; password: string }) =>
    request<{ accessToken: string }>('/v1/auth/login', { body: b, anonymous: true }),

  // --- merchant profile
  me: () => request<MerchantProfile>('/v1/merchants/me'),
  updateMe: (b: { name?: string; businessName?: string; businessType?: BusinessType; contactNumber?: string; websiteUrl?: string }) =>
    request<MerchantProfile>('/v1/merchants/me', { method: 'PUT', body: b }),
  saveSettlementAccount: (b: { accountNumber: string; ifsc: string; accountHolderName: string }) =>
    request<MerchantProfile>('/v1/merchants/me/settlement-account', { method: 'PUT', body: b }),
  submitKyc: (b: { panId: string; gstId?: string }) =>
    request<MerchantProfile>('/v1/merchants/me/kyc', { body: b }),

  // --- api keys
  listKeys: () => request<ApiKey[]>('/v1/merchants/api-keys'),
  createKey: (environment: Environment) => request<ApiKeyCreated>('/v1/merchants/api-keys', { body: { environment } }),
  rotateKey: (id: string) => request<ApiKeyCreated>(`/v1/merchants/api-keys/${id}/rotate`, { method: 'POST' }),
  revokeKey: (id: string) => request<void>(`/v1/merchants/api-keys/${id}`, { method: 'DELETE' }),

  // --- webhook endpoints
  listWebhooks: () => request<WebhookConfig[]>('/v1/merchants/webhooks'),
  createWebhook: (b: { targetUrl: string; eventTypes?: string }) =>
    request<WebhookConfig>('/v1/merchants/webhooks', { body: b }),
  updateWebhook: (id: string, b: { targetUrl: string; eventTypes?: string }) =>
    request<WebhookConfig>(`/v1/merchants/webhooks/${id}`, { method: 'PUT', body: b }),
  deleteWebhook: (id: string) => request<void>(`/v1/merchants/webhooks/${id}`, { method: 'DELETE' }),

  // --- webhook deliveries
  listWebhookEvents: (p: { status?: WebhookEventStatus; page?: number; size?: number } = {}) =>
    request<Page<WebhookEvent>>(`/v1/webhook-events${qs(p)}`),
  getWebhookEvent: (id: string) => request<WebhookEvent>(`/v1/webhook-events/${id}`),
  replayWebhookEvent: (id: string) => request<WebhookEvent>(`/v1/webhook-events/${id}/replay`, { method: 'POST' }),

  // --- vault
  tokenize: (
    b: { pan: string; cvv: string; expiryMonth: number; expiryYear: number; cardHolderName?: string; customerId?: string },
    basic?: ApiKeyCredentials | null,
  ) => request<TokenizeResponse>('/v1/vault/tokenize', { body: b, basic }),

  // --- orders
  createOrder: (
    b: {
      amount: { amountUnits: number; currency: string }
      receipt?: string
      notes?: Record<string, unknown>
      customer?: { name?: string; email?: string; phone?: string }
    },
    basic?: ApiKeyCredentials | null,
  ) => request<Order>('/v1/orders', { body: b, basic }),
  listOrders: (p: { status?: OrderStatus; page?: number; size?: number } = {}) =>
    request<Page<Order>>(`/v1/orders${qs(p)}`),
  cancelOrder: (id: string) => request<Order>(`/v1/orders/${id}/cancel`, { method: 'POST' }),

  // --- payments
  initiatePayment: (
    b: { orderId: string; method: PaymentMethod; methodDetails?: Record<string, unknown> },
    basic?: ApiKeyCredentials | null,
  ) =>
    request<Payment>('/v1/payments', {
      body: b, basic, headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    }),
  listPayments: (p: { status?: PaymentStatus; method?: PaymentMethod; orderId?: string; page?: number; size?: number } = {}) =>
    request<Page<Payment>>(`/v1/payments${qs(p)}`),
  getPayment: (id: string, basic?: ApiKeyCredentials | null) => request<Payment>(`/v1/payments/${id}`, { basic }),
  paymentTimeline: (id: string) => request<PaymentTransition[]>(`/v1/payments/${id}/timeline`),
  capturePayment: (id: string, basic?: ApiKeyCredentials | null) =>
    request<Payment>(`/v1/payments/${id}/capture`, { method: 'POST', basic }),

  // --- refunds
  listPaymentRefunds: (paymentId: string) => request<Refund[]>(`/v1/payments/${paymentId}/refunds`),
  refund: (paymentId: string, amountUnits?: number) =>
    request<Refund>(`/v1/payments/${paymentId}/refunds`, {
      body: amountUnits ? { amountUnits } : {},
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    }),
  listRefunds: (p: { page?: number; size?: number } = {}) => request<Page<Refund>>(`/v1/refunds${qs(p)}`),

  // --- settlements
  listSettlements: (p: { page?: number; size?: number } = {}) => request<Page<Settlement>>(`/v1/settlements${qs(p)}`),
  getSettlement: (id: string) => request<Settlement>(`/v1/settlements/${id}`),
  runSettlement: () => request<RunSettlementResult>('/v1/settlements/run', { method: 'POST' }),
}

/** Decode (without verifying) the claims of the session JWT. */
export function decodeToken(token: string | null): { merchantId?: string; role?: string; exp?: number } | null {
  if (!token) return null
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return { merchantId: p.merchant_id, role: p.role, exp: p.exp }
  } catch { return null }
}
