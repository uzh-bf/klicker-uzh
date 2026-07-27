---
question: Give me details and activity counts for course 00000000-0000-4000-8000-000000000000.
tool_policy: subset
expected_calls:
  - name: klicker_lecturer_course_get
    arguments:
      courseId: 00000000-0000-4000-8000-000000000000
fault_type: tool_error
expected_http_status: 200
scope: ACCOUNT_OWNER
---

The id is a syntactically valid UUID (passes `courseGetSchema`'s
`.uuid()` check) but is not shared with the eval lecturer, so
`service.getCourse` throws `LecturerMcpAuthorizationError('Object not found
or not accessible')`. `runLecturerReadTool` (apps/mcp-lecturer/src/
toolRunner.ts) catches it and returns a normal (non-throwing)
`tool-output-available` chunk whose JSON body is
`{"error": {"code": "FORBIDDEN", "message": "Object not found or not
accessible"}}` -- real HTTP 200, real tool call, no stub. The model must not
claim it found or created anything from this.
