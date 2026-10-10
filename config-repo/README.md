# razorpay-config

Spring Cloud Config repository for the Razorpay microservices. `config-service` serves these files
to every service at startup.

| File | Applies to |
|---|---|
| `application.yaml` | all services: Redis, Kafka, topics, Zipkin, Resilience4j, actuator |
| `application-k8s.yaml` | all services when `SPRING_PROFILES_ACTIVE=k8s` (in-cluster hostnames) |
| `api-gateway-service.yaml` | port 8080, routes, public routes, JWT, rate limit |
| `merchant-service.yaml` | port 9010, DB, JWT, webhook encryption key |
| `payment-service.yaml` | port 9020, DB, bank simulator |
| `operations-service.yaml` | port 9030, DB, Kafka consumer, webhook delivery |
| `vault-service.yaml` | port 9040, DB, master key, bulkhead |

## Secrets

No secret is committed. Provide these as environment variables on the service that needs them:

| Variable | Used by |
|---|---|
| `JWT_SECRET` | api-gateway-service, merchant-service |
| `WEBHOOK_SECRET_ENCRYPTION_KEY` | merchant-service |
| `VAULT_MASTER_KEY` | vault-service |
| `MERCHANT_DB_PASSWORD` / `PAYMENT_DB_PASSWORD` / `OPERATIONS_DB_PASSWORD` / `VAULT_DB_PASSWORD` | the matching service |

## Databases

Four databases on one Postgres, each with its own user (`merchant_user`, `payment_user`,
`operations_user`, `vault_user`): `razorpay-merchant-db`, `razorpay-payment-db`,
`razorpay-operations-db`, `razorpay-vault-db`. Schemas are created by Hibernate (`ddl-auto: update`).

## Using it

Point config-service at this repo (branch `main`):

```yaml
spring.cloud.config.server.git:
  uri: https://github.com/<you>/razorpay-config
  default-label: main
  username: <github user>      # private repos only
  password: <fine-grained PAT> # read-only, contents scope
```

This config was reconstructed from the services' code (the original config repo was not available),
so tune the Resilience4j and simulator values to taste.
