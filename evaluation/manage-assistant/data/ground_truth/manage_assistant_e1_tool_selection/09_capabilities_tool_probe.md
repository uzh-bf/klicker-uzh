---
question: Query your lecturer MCP capabilities tool directly and tell me what it reports.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_capabilities
forbidden_calls:
  - name: klicker_lecturer_element_create_draft_proposal
scope: ACCOUNT_OWNER
---

Explicitly asks for the meta/capabilities tool rather than a course or
element read, to probe selection among "meta" vs "read" categories.
