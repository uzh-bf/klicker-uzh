## 2026-08-12

**Update**

- Added an exact-origin allowlist for request-scoped provider credentials at
  both the public `chat-api` host and the selected engine. Empty configuration
  disables request-scoped mode without affecting deployment-owned credentials.
- Added matching local, staging, and production configuration for the existing
  LiteLLM origins.
- Kept the unfinished `v3-ai` roll-up outside this foundation. Its generalized
  MCP surfaces can integrate later through the fail-closed tool authorization
  seam, which requires an approved tool set and scoped execution token together.
