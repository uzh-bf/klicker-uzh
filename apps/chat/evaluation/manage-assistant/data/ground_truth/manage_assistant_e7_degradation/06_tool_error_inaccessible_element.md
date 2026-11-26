---
question: Show me the full details of question ID 999999999, including options and feedback.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_element_get
    arguments:
      elementId: 999999999
fault_type: tool_error
expected_http_status: 200
degradation_channel: assistant_text
scope: ACCOUNT_OWNER
---

Same fault mechanism as case 05, over `element_get` instead of `course_get`
(a positive integer id that does not exist, so `getElement` also throws the
generic "Object not found or not accessible" authorization error, caught
into a normal-but-error-shaped tool output).
