# PayFlow: Distributed Payment Gateway

A Razorpay-style payments platform built as Spring Boot microservices, with a React merchant console.

| Module | Role | Port |
|---|---|---|
| `api-gateway-service` | Edge gateway: API-key / JWT auth, rate limiting | 8080 |
| `merchant-service` | Signup/login, API keys, webhook configs, customers | 9010 |
| `payment-service` | Orders, payments, state machine, transactional outbox | 9020 |
| `operations-service` | Webhook delivery with retries + DLQ, nightly settlement | 9030 |
| `vault-service` | Card tokenization (envelope encryption) and charging | 9040 |
| `config-service` | Spring Cloud Config server (serves `config-repo/`) | 8888 |
| `discovery-service` | Eureka (optional; Feign uses direct URLs) | 8761 |
| `common-lib` | Shared auto-configuration: idempotency, rate limiters, errors, audit | n/a |
| `frontend` | React + Vite + Tailwind merchant console | 5173 |
| `config-repo` | The configuration files served by `config-service` | n/a |
| `k8s`, `observability` | kind/Kustomize manifests; Zipkin, Prometheus, Grafana | n/a |

Java 25, Spring Boot 4.1, Spring Cloud 2025.1. Infrastructure: Postgres 16, Redis 7, Kafka.

## Run locally

1. Start Postgres (databases `razorpay-{merchant,payment,operations,vault}-db` with users
   `{merchant,payment,operations,vault}_user`), Redis and Kafka on their default ports.
2. Export the secrets each service needs (see `config-repo/README.md`):
   `JWT_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_KEY` (base64, 32 bytes), `VAULT_MASTER_KEY` (base64, 32 bytes)
   and the four `*_DB_PASSWORD` values. Give each service only its own secrets.
3. Build the shared library: `cd common-lib && ./mvnw install`.
4. Start `config-service`, then the business services, then `api-gateway-service`
   (`./mvnw spring-boot:run` in each directory).
5. `cd frontend && npm install && npm run dev` and open http://localhost:5173.

`config-service` reads this repository's `config-repo/` folder by default. Override with
`GIT_CONFIG_REPO`, `GIT_CONFIG_PATH`, `GIT_CONFIG_LABEL`, `GIT_USERNAME`, `GIT_PASSWORD`.

## Kubernetes

`k8s/` targets a kind cluster. Copy `k8s/k8s-secrets.env.example` to `k8s/k8s-secrets.env`, fill in
real values, then `kubectl apply -k k8s`. Never commit `k8s-secrets.env`.

## Known issues

- No read/list endpoints for orders or payments yet.
- `DELETE /v1/merchants/api-keys/{id}` is mapped to the literal path `/keyId`.
- Several entities need `@Builder.Default` (order and merchant `status` come back null).
- Merchants are never promoted from `PENDING_KYC`, so nightly settlement has nobody to process.
