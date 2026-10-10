# Razorpay Console (frontend)

React + Vite + TypeScript + Tailwind merchant dashboard for the microservices in this repo.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api/*` to the API gateway (default `http://localhost:8080`), so no CORS
setup is needed. Point it elsewhere with `GATEWAY_URL=http://host:port npm run dev`, or set
`VITE_API_BASE` to a full URL for production builds (the gateway must then allow CORS).

## Pages

| Page | Backend |
|---|---|
| Sign in / Sign up | `POST /v1/auth/login`, `/v1/auth/signup` |
| API keys | `/v1/merchants/api-keys` (create, list, rotate, revoke) |
| Webhooks | `/v1/merchants/webhooks` (CRUD) |
| Payments | `POST /v1/orders`, `/v1/vault/tokenize`, `/v1/payments`, `/v1/payments/{id}/capture` |
| Overview | Derived from the above + local activity |

## Known backend gaps

- No read/list endpoints for orders or payments, so the Payments activity list is kept in
  `localStorage` for this browser only, and payment status can't be refreshed after the initial response.
- `DELETE /v1/merchants/api-keys/{id}` is mapped as the literal `/keyId` in `ApiKeyController`, so
  **Revoke** returns an error until that is fixed.
- No merchant profile endpoint; the sidebar shows claims decoded from the JWT.
