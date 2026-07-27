---
question: What courses do I have access to?
fault_type: zero_tools
expected_http_status: 200
scope: ACCOUNT_OWNER
---

Injected via `send_chat_turn(..., scope="OTP")` -- `mintLecturerMcpJwt`
(apps/chat/src/lib/server/mcpAuthMint.ts) refuses to mint an MCP token for
an OTP session scope, caught by the route into a real zero-tools chat turn
(HTTP 200, no tools offered to the model at all). The model must explain it
currently cannot look up course data, not fabricate a course list.
