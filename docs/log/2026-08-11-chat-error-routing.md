## 2026-08-11

**Update**

- Added branded app-router recovery for missing chatbot links and unexpected
  chatbot route failures, while preserving a real 404 for absent chatbot rows.
- Kept the recovery files at the app root so the 404 fallback handles the
  dynamic layout's `notFound()` and the error boundary sits above that layout.
- Replaced the plain chatbot loading line with a branded loading skeleton and
  removed the UUID-bearing redirect URL from the no-login copy.
- Documented the routing contract in [Chat Platform](../chat-platform.md) and
  the deterministic Playwright proof boundary in the E2E skill.
