---
question: Search my question pool for anything about variance.
fault_type: expired_token
expected_http_status: 401
degradation_channel: transport_ui
scope: ACCOUNT_OWNER
---

Second expired-token case with a different prompt, for repeat coverage of
the same fault (mirrors E5/E6's own N-of-M repeated-probe style, though
`expired_token` is fully deterministic per attempt so a single trial per
case already proves the same thing every time).
