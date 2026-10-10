#!/usr/bin/env node
// End-to-end smoke test against a running stack (gateway on :8080 by default).
//   node scripts/smoke-test.mjs            # or: GATEWAY=http://host:8080 node scripts/smoke-test.mjs
// Exits non-zero if any check fails. Creates its own throwaway merchants.

const BASE = process.env.GATEWAY ?? 'http://localhost:8080'
let passed = 0
let failed = 0

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ok    ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? `  ->  ${detail}` : ''}`)
  }
}

async function call(path, { method, body, token, basic, headers = {} } = {}) {
  const h = { Accept: 'application/json', ...headers }
  if (body !== undefined) h['Content-Type'] = 'application/json'
  if (token) h.Authorization = `Bearer ${token}`
  if (basic) h.Authorization = `Basic ${Buffer.from(`${basic.keyId}:${basic.secret}`).toString('base64')}`
  const res = await fetch(BASE + path, {
    method: method ?? (body !== undefined ? 'POST' : 'GET'),
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* not json */ }
  return { status: res.status, json }
}

async function until(label, fn, { tries = 40, delay = 1000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = await fn()
    if (v) return v
    await sleep(delay)
  }
  console.log(`  (timed out waiting for: ${label})`)
  return null
}

async function newMerchant(label) {
  const email = `smoke.${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`
  const signup = await call('/v1/auth/signup', {
    body: { name: `Smoke ${label}`, email, password: 'password123', businessName: 'Smoke Co', businessType: 'LLP' },
  })
  const login = await call('/v1/auth/login', { body: { email, password: 'password123' } })
  return { email, signup, token: login.json?.accessToken }
}

const rupees = (units) => ({ amountUnits: units, currency: 'INR' })
const receipt = () => `smoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

async function payWithCard(token, orderId, customerId, pan = '4111111111111111') {
  const tok = await call('/v1/vault/tokenize', {
    token,
    body: { pan, cvv: '123', expiryMonth: 12, expiryYear: new Date().getFullYear() + 3, cardHolderName: 'Smoke Test', customerId },
  })
  const pay = await call('/v1/payments', {
    token,
    headers: { 'X-Idempotency-Key': `smoke-${Date.now()}-${Math.random()}` },
    body: { orderId, method: 'CARD', methodDetails: { token: tok.json?.token } },
  })
  return { tok, pay }
}

async function newOrder(token, units) {
  const res = await call('/v1/orders', {
    token,
    body: { amount: rupees(units), receipt: receipt(), customer: { name: 'Smoke Customer', email: 'c@example.com', phone: '9999999999' } },
  })
  return res
}

async function main() {
  console.log(`Smoke test against ${BASE}\n`)

  console.log('Auth')
  const m = await newMerchant('a')
  check('signup returns 201 with a status', m.signup.status === 201 && m.signup.json?.merchantStatus === 'PENDING_KYC',
    JSON.stringify(m.signup.json))
  check('login returns a token', !!m.token)
  const badPw = await call('/v1/auth/login', { body: { email: m.email, password: 'wrong-password' } })
  check('wrong password -> 401', badPw.status === 401, String(badPw.status))
  const noUser = await call('/v1/auth/login', { body: { email: 'nobody@example.com', password: 'whatever12' } })
  check('unknown email -> 401', noUser.status === 401, String(noUser.status))
  const noToken = await call('/v1/orders', { body: { amount: rupees(100) } })
  check('request without credentials -> 401', noToken.status === 401, String(noToken.status))

  console.log('\nMerchant profile and KYC')
  const me = await call('/v1/merchants/me', { token: m.token })
  check('GET /merchants/me', me.status === 200 && me.json?.merchantStatus === 'PENDING_KYC', JSON.stringify(me.json))
  const kycEarly = await call('/v1/merchants/me/kyc', { token: m.token, body: { panId: 'ABCDE1234F' } })
  check('KYC before a bank account is refused', kycEarly.status === 400 && kycEarly.json?.errorCode === 'SETTLEMENT_ACCOUNT_REQUIRED',
    JSON.stringify(kycEarly.json))
  const badIfsc = await call('/v1/merchants/me/settlement-account', {
    token: m.token, method: 'PUT', body: { accountNumber: '123456789012', ifsc: 'nope', accountHolderName: 'Smoke Co' },
  })
  check('invalid IFSC is rejected', badIfsc.status === 400, String(badIfsc.status))
  const acct = await call('/v1/merchants/me/settlement-account', {
    token: m.token, method: 'PUT', body: { accountNumber: '123456789012', ifsc: 'HDFC0001234', accountHolderName: 'Smoke Co' },
  })
  check('settlement account saved and masked', acct.status === 200 && acct.json?.settlementAccount?.maskedAccountNumber === '********9012',
    JSON.stringify(acct.json))
  const kyc = await call('/v1/merchants/me/kyc', { token: m.token, body: { panId: 'ABCDE1234F' } })
  check('KYC activates the merchant', kyc.status === 200 && kyc.json?.merchantStatus === 'ACTIVE', JSON.stringify(kyc.json))

  console.log('\nAPI keys')
  const key = await call('/v1/merchants/api-keys', { token: m.token, body: { environment: 'TEST' } })
  check('create key returns id + secret', key.status === 201 && !!key.json?.keySecret)
  const viaKey = await call('/v1/orders', {
    basic: { keyId: key.json?.keyId, secret: key.json?.keySecret },
    body: { amount: rupees(5000), receipt: receipt() },
  })
  check('API key (Basic auth) can create an order', viaKey.status === 201, String(viaKey.status))
  const badKey = await call('/v1/orders', {
    basic: { keyId: key.json?.keyId, secret: 'not-the-secret' },
    body: { amount: rupees(5000), receipt: receipt() },
  })
  check('wrong API secret -> 401', badKey.status === 401, String(badKey.status))
  const revoke = await call(`/v1/merchants/api-keys/${key.json?.id}`, { token: m.token, method: 'DELETE' })
  check('revoke key', revoke.status === 204, String(revoke.status))
  const afterRevoke = await call('/v1/orders', {
    basic: { keyId: key.json?.keyId, secret: key.json?.keySecret },
    body: { amount: rupees(5000), receipt: receipt() },
  })
  check('revoked key stops working', afterRevoke.status === 401, String(afterRevoke.status))

  console.log('\nWebhook endpoint')
  const hook = await call('/v1/merchants/webhooks', {
    token: m.token, body: { targetUrl: 'http://localhost:9030/webhook/success', eventTypes: 'ALL' },
  })
  check('webhook created with a signing secret', hook.status === 200 && !!hook.json?.webhookSecret, JSON.stringify(hook.json))

  console.log('\nOrders and card payment')
  const orderRes = await newOrder(m.token, 100_000)
  const order = orderRes.json
  check('order created with status CREATED', orderRes.status === 201 && order?.status === 'CREATED', JSON.stringify(order))
  const dup = await call('/v1/orders', {
    token: m.token, body: { amount: rupees(100), receipt: order?.receipt },
  })
  check('duplicate receipt -> 409', dup.status === 409, String(dup.status))

  const { pay } = await payWithCard(m.token, order.id, order.customerId)
  check('card payment initiated', pay.status === 201 && pay.json?.status === 'AUTHORIZING', JSON.stringify(pay.json))
  const paymentId = pay.json?.id

  const captured = await until('payment CAPTURED', async () => {
    const p = await call(`/v1/payments/${paymentId}`, { token: m.token })
    return p.json?.status === 'CAPTURED' ? p.json : null
  })
  check('payment reaches CAPTURED', !!captured)

  const orderAfter = await call(`/v1/orders/${order.id}`, { token: m.token })
  check('order becomes PAID', orderAfter.json?.status === 'PAID', JSON.stringify(orderAfter.json?.status))

  const list = await call('/v1/payments?status=CAPTURED&size=5', { token: m.token })
  check('list payments filters by status', list.status === 200 && list.json?.items?.some((p) => p.id === paymentId),
    JSON.stringify(list.json?.totalItems))
  const orders = await call('/v1/orders?status=PAID', { token: m.token })
  check('list orders filters by status', orders.json?.items?.some((o) => o.id === order.id))
  const timeline = await call(`/v1/payments/${paymentId}/timeline`, { token: m.token })
  const events = (timeline.json ?? []).map((t) => t.event)
  check('timeline records the full lifecycle',
    ['AUTHORIZE_ATTEMPT', 'AUTHORIZE_SUCCESS', 'CAPTURE_REQUEST', 'CAPTURE_SUCCESS'].every((e) => events.includes(e)),
    events.join(','))

  console.log('\nIdempotency')
  const order2 = (await newOrder(m.token, 2_500)).json
  const idemKey = `smoke-idem-${Date.now()}`
  const upi = (k) => call('/v1/payments', {
    token: m.token, headers: { 'X-Idempotency-Key': k },
    body: { orderId: order2.id, method: 'UPI', methodDetails: { vpa: 'success@okaxis' } },
  })
  const first = await upi(idemKey)
  const second = await upi(idemKey)
  check('same key replays the same payment', first.status === 201 && first.json?.id === second.json?.id,
    `${first.json?.id} vs ${second.json?.id}`)

  console.log('\nRefunds')
  const r1 = await call(`/v1/payments/${paymentId}/refunds`, { token: m.token, body: { amountUnits: 10_000 } })
  check('partial refund created', r1.status === 201 && r1.json?.status === 'PROCESSED', JSON.stringify(r1.json))
  const afterPartial = await call(`/v1/payments/${paymentId}`, { token: m.token })
  check('payment is PARTIALLY_REFUNDED with the refunded total',
    afterPartial.json?.status === 'PARTIALLY_REFUNDED' && afterPartial.json?.refundedAmountUnits === 10_000,
    JSON.stringify(afterPartial.json?.status) + ' ' + afterPartial.json?.refundedAmountUnits)
  const tooMuch = await call(`/v1/payments/${paymentId}/refunds`, { token: m.token, body: { amountUnits: 95_000 } })
  check('refund above the balance -> 400', tooMuch.status === 400 && tooMuch.json?.errorCode === 'REFUND_AMOUNT_INVALID',
    JSON.stringify(tooMuch.json))
  const r2 = await call(`/v1/payments/${paymentId}/refunds`, { token: m.token, body: { amountUnits: 40_000 } })
  check('second partial refund allowed', r2.status === 201, String(r2.status))
  const refundList = await call(`/v1/payments/${paymentId}/refunds`, { token: m.token })
  check('refund list for the payment', Array.isArray(refundList.json) && refundList.json.length === 2)
  const r3 = await call(`/v1/payments/${paymentId}/refunds`, { token: m.token, body: {} })
  check('empty body refunds the remaining 50000', r3.status === 201 && r3.json?.amount?.amountUnits === 50_000,
    JSON.stringify(r3.json))
  const fullyRefunded = await call(`/v1/payments/${paymentId}`, { token: m.token })
  check('payment ends REFUNDED', fullyRefunded.json?.status === 'REFUNDED', fullyRefunded.json?.status)
  const again = await call(`/v1/payments/${paymentId}/refunds`, { token: m.token, body: { amountUnits: 1 } })
  check('a refunded payment cannot be refunded again', again.status === 400, String(again.status))

  console.log('\nFailures and isolation')
  const declinedOrder = (await newOrder(m.token, 1_000)).json
  const declined = await payWithCard(m.token, declinedOrder.id, declinedOrder.customerId, '4000000000000002')
  check('declined card -> FAILED / CARD_DECLINED',
    declined.pay.json?.status === 'FAILED' && declined.pay.json?.errorCode === 'CARD_DECLINED', JSON.stringify(declined.pay.json))
  const upiFail = await call('/v1/payments', {
    token: m.token,
    body: { orderId: declinedOrder.id, method: 'UPI', methodDetails: { vpa: 'fail@okaxis' } },
  })
  check('failing VPA -> FAILED', upiFail.json?.status === 'FAILED', JSON.stringify(upiFail.json))

  const other = await newMerchant('b')
  const peek = await call(`/v1/payments/${paymentId}`, { token: other.token })
  check("another merchant cannot read this merchant's payment", peek.status === 404, String(peek.status))
  const otherOrder = (await newOrder(other.token, 1_000)).json
  const stolen = await payWithCard(m.token, order2.id, order2.customerId) // a token owned by merchant A
  const stolenTokenUse = await call('/v1/payments', {
    token: other.token,
    body: { orderId: otherOrder.id, method: 'CARD', methodDetails: { token: stolen.tok.json?.token } },
  })
  check("a card token cannot be charged by another merchant", stolenTokenUse.json?.status === 'FAILED',
    JSON.stringify(stolenTokenUse.json))

  console.log('\nSettlement')
  // Capture a fresh payment, then settle on demand.
  const sOrder = (await newOrder(m.token, 200_000)).json
  const sPay = await payWithCard(m.token, sOrder.id, sOrder.customerId)
  const sCaptured = await until('settlement payment CAPTURED', async () => {
    const p = await call(`/v1/payments/${sPay.pay.json?.id}`, { token: m.token })
    return p.json?.status === 'CAPTURED' ? p.json : null
  })
  check('payment to settle is CAPTURED', !!sCaptured)

  const run = await call('/v1/settlements/run', { token: m.token, method: 'POST' })
  check('settlement run initiated', run.status === 200 && run.json?.settled === true, JSON.stringify(run.json))
  const settlementId = run.json?.settlement?.id
  const processed = await until('settlement PROCESSED', async () => {
    const s = await call(`/v1/settlements/${settlementId}`, { token: m.token })
    return s.json?.status === 'PROCESSED' ? s.json : null
  })
  check('settlement reaches PROCESSED', !!processed, JSON.stringify(run.json))
  if (processed) {
    const gross = processed.grossAmount.amountUnits
    check('fee 2% + GST 18% of fee',
      processed.feeAmount.amountUnits === Math.round(gross * 0.02) &&
      processed.netAmount.amountUnits === gross - processed.feeAmount.amountUnits - processed.gstAmount.amountUnits,
      JSON.stringify(processed))
    check('settlement lists its payments', processed.paymentIds?.includes(sPay.pay.json?.id))
  }
  const settledPayment = await until('payment SETTLED', async () => {
    const p = await call(`/v1/payments/${sPay.pay.json?.id}`, { token: m.token })
    return p.json?.status === 'SETTLED' ? p.json : null
  }, { tries: 15 })
  check('settled payment becomes SETTLED', !!settledPayment)
  const nothing = await call('/v1/settlements/run', { token: m.token, method: 'POST' })
  check('running again with nothing to settle is a no-op', nothing.json?.settled === false, JSON.stringify(nothing.json))
  const settlementList = await call('/v1/settlements', { token: m.token })
  check('settlement list', settlementList.json?.items?.some((s) => s.id === settlementId))

  console.log('\nWebhook deliveries')
  const delivered = await until('a DELIVERED webhook event', async () => {
    const ev = await call('/v1/webhook-events?status=DELIVERED', { token: m.token })
    return ev.json?.items?.length ? ev.json.items : null
  }, { tries: 30 })
  check('webhook events are delivered to the endpoint', !!delivered)
  if (delivered) {
    const detail = await call(`/v1/webhook-events/${delivered[0].id}`, { token: m.token })
    check('event detail includes payload', detail.status === 200 && !!detail.json?.payload)
    const replay = await call(`/v1/webhook-events/${delivered[0].id}/replay`, { token: m.token, method: 'POST' })
    check('delivered event can be replayed', replay.status === 200 && replay.json?.status === 'PENDING', JSON.stringify(replay.json?.status))
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Smoke test crashed:', e)
  process.exit(2)
})
