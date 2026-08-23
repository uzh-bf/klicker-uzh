# 37. Provider credentials use dedicated vault custody behind an internal gateway

- **Status:** Proposed — 2026-08-23

## Context

The current chat model stores `Chatbot.openaiApiKey` in PostgreSQL encrypted
with the application-wide `APP_SECRET`, decrypts it in the chat request path,
and accepts a separate custom base URL. This couples secret custody to product
data, gives every compatible application process the decryption boundary, and
does not provide a reusable lifecycle for tutoring, generation, grading,
embeddings, or Catalyst services.

The product still needs canonical ownership, bindings, delegation, quotas,
notices, and lifecycle state. Those facts are relational product state and do
not belong in a secret store.

## Decision

KlickerUZH owns the canonical Provider Credential and Credential Binding
records. PostgreSQL stores only an opaque secret handle and version, ownership,
provider profile, validated capabilities, lifecycle state, bindings, budgets,
notice state, and timestamps. It never stores a provider secret or a
user-supplied provider endpoint.

A standalone internal AI Credential Gateway owns registration, validation,
rotation, revocation, Azure Key Vault access, request authorization, and
forwarding. Browser clients, Klicker runtimes, and Catalyst services never
receive the provider secret. It has no Prisma access and owns no canonical
product state. The gateway accepts only a short-lived, single-request
authorization issued after Klicker has resolved the caller, chatbot binding,
active participation, model policy, notice, and hard quota reservation. It
atomically consumes that authorization through a private Klicker control-plane
contract before reading the secret.

Credential input uses a dedicated authenticated backend endpoint with request
body logging and tracing disabled. It does not use a GraphQL mutation, because
provider secrets must not enter the existing GraphQL request-logging boundary.

Each institutional tenant receives a dedicated AI Credential Gateway
application vault per environment and region. The first UZH deployment
therefore uses one UZH gateway vault in each environment; it does not reuse a
shared Klicker vault. A future external institution gets a separate vault
rather than sharing the UZH boundary. Vaults use Azure RBAC, private endpoints,
workload identity, purge protection, the existing 90-day soft-delete default,
diagnostics, and named break-glass procedures.

Azure Key Vault already encrypts every vault at rest with keys held in HSMs.
The first version does not add application-side envelope encryption or a second
customer-managed key. That requirement is reopened only if an institutional
control explicitly requires customer-controlled envelope encryption.

## Considered options

- Keep encrypted keys in PostgreSQL: rejected because it preserves the broad
  application decryption boundary and duplicates secret lifecycle machinery.
- Let each runtime read Key Vault: rejected because it multiplies workload
  identities, authorization implementations, and cross-tenant confused-deputy
  risk.
- Create one vault per credential: rejected for the first version because the
  operational complexity is disproportionate; tenant and environment remain
  the vault isolation boundary.

## Consequences

- The gateway becomes a high-value security boundary and must remain internal,
  least-privileged, rate-limited, and independently observable.
- A compromised gateway identity can read secrets within one gateway vault; the
  per-tenant vault boundary limits but does not eliminate that blast radius.
- Rotation can validate a new vault version before atomically switching the
  product handle; revocation and deletion can disable product use before
  asynchronous physical cleanup completes.
- The existing PostgreSQL credential fields and plaintext-compatible decryption
  path must be removed after a values-suppressed migration audit.

## References

- [Azure Key Vault overview](https://learn.microsoft.com/en-us/azure/key-vault/general/overview)
- [Secure Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/secure-key-vault)
- [AKS Workload ID](https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview)
