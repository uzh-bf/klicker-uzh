## 2026-08-12

**Update**: Documented the persisted Live Quiz response modes, the PWA
response-api routing and privacy notice, and the permission-gated ended-quiz
correlated export UI in [Frontend Conventions](../frontend-conventions.md),
[Architecture Overview](../architecture-overview.md), and [Testing](../testing.md).
Updated the frontend, verification, and Playwright skills with the matching
browser-gate expectations. The cookie-blocked path retries identity
initialization after the first cookie-backed response returns identity `401`,
then returns a signed quiz-scoped respondent token for page-memory fallback.
The normal cookie-retained path does not expose that token to page JavaScript.
The correlated teaching export excludes free-text answers.
