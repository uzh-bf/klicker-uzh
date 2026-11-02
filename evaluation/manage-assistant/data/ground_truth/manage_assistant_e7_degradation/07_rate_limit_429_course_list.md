---
question: What courses do I have access to?
fault_type: rate_limit_429
expected_http_status: 429
degradation_channel: transport_ui
scope: ACCOUNT_OWNER
---

Injected through the real 30-req/5-min limiter
(apps/chat/src/services/rateLimiter.ts) with a fresh dummy subject. Thirty
authenticated but structurally invalid bodies consume limiter slots and
return 400 before any model call; the next request captures the real 429
body and `Retry-After` header. See test_e7_degradation.py's module docstring
and the README. There is one case because the public limiter contract is
deterministic and additional cases would not add coverage.
