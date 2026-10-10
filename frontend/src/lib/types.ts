export type Environment = 'LIVE' | 'TEST'
export type PaymentMethod = 'CARD' | 'NETBANKING' | 'UPI' | 'WALLET'
export type OrderStatus = 'CREATED' | 'ATTEMPTED' | 'PAID' | 'CANCELLED'
export type PaymentStatus =
  | 'CREATED' | 'AUTHORIZING' | 'AUTHORIZED' | 'CAPTURING' | 'CAPTURED'
  | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'SETTLED' | 'AUTH_EXPIRED'
export type BusinessType =
  | 'LLP' | 'PROPRIETORSHIP' | 'PARTNERSHIP' | 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'TRUST'
export type MerchantStatus = 'PENDING_KYC' | 'ACTIVE' | 'SUSPENDED'
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED'
export type SettlementStatus = 'INITIATED' | 'TRANSFER_PENDING' | 'PROCESSED' | 'FAILED'
export type WebhookEventStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'DEAD'

export interface Money { amountUnits: number; currency: string }

export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

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
  bankReference?: string
  errorCode?: string
  errorDescription?: string
  refundedAmountUnits?: number
  authorizedAt?: string
  capturedAt?: string
  settledAt?: string
  createdAt: string
}

export interface PaymentTransition {
  fromStatus?: PaymentStatus
  event: string
  toStatus: PaymentStatus
  actor?: string
  occurredAt: string
}

export interface Refund {
  id: string
  paymentId: string
  amount: Money
  status: RefundStatus
  bankReference?: string
  errorCode?: string
  errorDescription?: string
  processedAt?: string
  createdAt: string
}

export interface Settlement {
  id: string
  grossAmount: Money
  refundAmount: Money
  feeAmount: Money
  gstAmount: Money
  netAmount: Money
  status: SettlementStatus
  bankReference?: string
  failureReason?: string
  processedAt?: string
  createdAt: string
  paymentIds?: string[]
}

export interface RunSettlementResult { settled: boolean; message: string; settlement?: Settlement }

export interface WebhookEvent {
  id: string
  eventType: string
  targetUrl: string
  status: WebhookEventStatus
  attempts: number
  lastResponseCode?: number
  lastResponseBody?: string
  lastAttemptAt?: string
  nextRetryAt?: string
  deliveredAt?: string
  createdAt: string
  payload?: Record<string, unknown>
}

export interface TokenizeResponse {
  token: string
  lastFour: string
  brand: string
  expiryMonth: number
  expiryYear: number
}

export interface MerchantProfile {
  id: string
  name: string
  email: string
  contactNumber?: string
  businessName?: string
  businessType?: BusinessType
  websiteUrl?: string
  merchantStatus: MerchantStatus
  panId?: string
  gstId?: string
  settlementAccount?: { maskedAccountNumber: string; ifsc: string; accountHolderName: string }
  settlementAccountConfigured: boolean
  kycComplete: boolean
}

export interface MerchantResponse {
  id: string
  name: string
  email: string
  businessName?: string
  businessType?: BusinessType
  merchantStatus: MerchantStatus
}
