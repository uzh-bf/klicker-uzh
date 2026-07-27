---
question: What courses do I have access to?
fault_type: rate_limit_429
expected_http_status: 429
scope: ACCOUNT_OWNER
---

The one fault type this harness cannot reproduce for real without either a
stub or spending ~30 real chat turns on a single sub to exhaust the live
30-req/5-min limiter (apps/chat/src/services/rateLimiter.ts) -- see
test_e7_degradation.py's module docstring and the README. Injected via
`httpx.MockTransport` (httpx's own public transport-injection seam, run
through the harness's real request/retry code in sse_client.py) rather than
a live request; only one case, since the fault is fully deterministic per
attempt and adding more would not add coverage.
