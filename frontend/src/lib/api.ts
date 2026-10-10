import type {
  ApiKey, ApiKeyCreated, Environment, MerchantResponse, Order, Payment,
  PaymentMethod, TokenizeResponse, WebhookConfig, BusinessType,
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

export const api = {
  signup: (b: { name: string; email: string; password: string; businessName?: string; businessType?: BusinessType }) =>
    request<MerchantResponse>('/v1/auth/signup', { body: b, anonymous: true }),
  login: (b: { email: string; password: string }) =>
    request<{ accessToken: string }>('/v1/auth/login', { body: b, anonymous: true }),

  listKeys: () => request<ApiKey[]>('/v1/merchants/api-keys'),
  createKey: (environment: Environment) => request<ApiKeyCreated>('/v1/merchants/api-keys', { body: { environment } }),
  rotateKey: (id: string) => request<ApiKeyCreated>(`/v1/merchants/api-keys/${id}/rotate`, { method: 'POST' }),
  revokeKey: (id: string) => request<void>(`/v1/merchants/api-keys/${id}`, { method: 'DELETE' }),

  listWebhooks: () => request<WebhookConfig[]>('/v1/merchants/webhooks'),
  createWebhook: (b: { targetUrl: string; eventTypes?: string }) =>
    request<WebhookConfig>('/v1/merchants/webhooks', { body: b }),
  updateWebhook: (id: string, b: { targetUrl: string; eventTypes?: string }) =>
    request<WebhookConfig>(`/v1/merchants/webhooks/${id}`, { method: 'PUT', body: b }),
  deleteWebhook: (id: string) => request<void>(`/v1/merchants/webhooks/${id}`, { method: 'DELETE' }),

  tokenize: (
    b: { pan: string; cvv: string; expiryMonth: number; expiryYear: number; cardHolderName?: string; customerId?: string },
    basic?: ApiKeyCredentials | null,
  ) => request<TokenizeResponse>('/v1/vault/tokenize', { body: b, basic }),

  createOrder: (
    b: {
      amount: { amountUnits: number; currency: string }
      receipt?: string
      notes?: Record<string, unknown>
      customer?: { name?: string; email?: string; phone?: string }
    },
    basic?: ApiKeyCredentials | null,
  ) => request<Order>('/v1/orders', { body: b, basic }),

  initiatePayment: (
    b: { orderId: string; method: PaymentMethod; methodDetails?: Record<string, unknown> },
    basic?: ApiKeyCredentials | null,
  ) =>
    request<Payment>('/v1/payments', {
      body: b, basic, headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    }),
  capturePayment: (id: string, basic?: ApiKeyCredentials | null) =>
    request<Payment>(`/v1/payments/${id}/capture`, { method: 'POST', basic }),
}

/** Decode (without verifying) the claims of the session JWT. */
export function decodeToken(token: string | null): { merchantId?: string; role?: string; exp?: number } | null {
  if (!token) return null
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return { merchantId: p.merchant_id, role: p.role, exp: p.exp }
  } catch { return null }
}
