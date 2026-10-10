export type Environment = 'LIVE' | 'TEST'
export type PaymentMethod = 'CARD' | 'NETBANKING' | 'UPI' | 'WALLET'
export type OrderStatus = 'CREATED' | 'ATTEMPTED' | 'PAID' | 'CANCELLED'
export type PaymentStatus =
  | 'CREATED' | 'AUTHORIZING' | 'AUTHORIZED' | 'CAPTURING' | 'CAPTURED'
  | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'SETTLED' | 'AUTH_EXPIRED'
export type BusinessType =
  | 'LLP' | 'PROPRIETORSHIP' | 'PARTNERSHIP' | 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'TRUST'

export interface Money { amountUnits: number; currency: string }

export interface ApiKey {
  id: string
  keyId: string
  environment: Environment
  enabled: boolean
  lastUsedAt?: string | null
  createdAt: string
}
export interface ApiKeyCreated { id: string; keyId: string; keySecret: string; environment: Environment }

export interface WebhookConfig {
  id: string
  targetUrl: string
  webhookSecret?: string
  enabled: boolean
  eventTypes?: string | null
}

export interface Order {
  id: string
  merchantId: string
  customerId?: string
  receipt?: string
  amount: Money
  status: OrderStatus
  attempts: number
  notes?: Record<string, unknown>
  expiresAt?: string
  createdAt: string
}

export interface Payment {
  id: string
  orderId: string
  merchantId: string
  amount: Money
  status: PaymentStatus
  method: PaymentMethod
  methodDetails?: Record<string, unknown>
  errorCode?: string
  errorDescription?: string
  capturedAt?: string
  createdAt: string
}

export interface TokenizeResponse {
  token: string
  lastFour: string
  brand: string
  expiryMonth: number
  expiryYear: number
}

export interface MerchantResponse {
  id: string
  name: string
  email: string
  businessName?: string
  businessType?: BusinessType
  merchantStatus: 'PENDING_KYC' | 'ACTIVE' | 'SUSPENDED'
}
