## 2026-08-11

**Creation**

- Documented the turn-scoped provider-option contract in
  [Chat Platform](../chat-platform.md): one pseudonymous turn key per
  assistant response and one thread-stable prompt-cache key.
- Documented the paired deployment experiment: LiteLLM router affinity is
  disabled explicitly while request and Langfuse correlation headers remain.
- Added the aggregate `--gateway-cost` report contract and synthetic
  fail-closed reconciliation checks to [Testing](../testing.md).

**Update**

- Local evidence covers Chat Completions and Responses request serialization,
  aggregate token algebra, and Langfuse/LiteLLM parity checks only. A staging
  rollout, paid measurement window, deployed cache hit rate, and Azure invoice
  remain separate approval gates.
