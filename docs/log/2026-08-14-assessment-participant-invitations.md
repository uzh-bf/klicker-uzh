## 2026-08-14

- **Update**: [Domain Model](../domain-model.md) records the two-state assessment invitation lifecycle, verified-affiliation auto-acceptance, duplicate handling, and pending-only deletion.
- **Update**: [GraphQL API Layer](../graphql-api-layer.md) records the course-scoped ADMIN/FULL_ACCESS invitation API and its per-row bulk result contract.
- **Update**: [Frontend Conventions](../frontend-conventions.md) records the assessment-course overflow entry point, event-time browser CSV parsing, visible partial failures, and pending-only deletion UI.
- **Verification**: The focused invitation service suite passes all 7 cases, `pnpm run check:all` and the production build pass, and a focused OpenGrep scan reports no feature-code findings. The new Playwright case is type-valid and discoverable, but its runtime could not start in the DevPod because the container lacks Chromium system libraries; the same workflow was completed manually in the real routed app in English, German, desktop, and mobile states.
- **Privacy**: Browser screenshots were captured from the real local interface after seeded participant email addresses and matriculation numbers were replaced in the browser DOM with synthetic placeholders. The unredacted local captures remain outside the public repository.
