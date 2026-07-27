---
question: What courses do I have access to?
fault_type: expired_token
expected_http_status: 401
scope: ACCOUNT_OWNER
---

Injected via `send_chat_turn(..., session_ttl_seconds=-30)` -- a genuinely
already-expired session JWT, same technique as X1's
`smoke-negative.ts` `expiresIn: '-30s'` case. `getAuthenticatedManageUser`
(apps/chat/src/lib/server/manageAuth.ts) rejects it before any model call,
so there is no assistant text at all for this turn -- only the deterministic
checks (fault-reproduced, no-fabrication, leak scan on the JSON error body)
apply; the graceful-message judge is never consulted for this case (see
test_e7_degradation.py).
