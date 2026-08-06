## 2026-08-06

- **Update**: [feature-flags](../feature-flags.md) records the first active flag, `learning-analytics`, its fail-closed default, per-user targeting, disabled-control semantics, and retained direct-route authorization.
- **Update**: [frontend-conventions](../frontend-conventions.md) replaces learning analytics' legacy `publicPreview` guidance with GrowthBook adoption guidance.
- **Behavior**: Manage initializes GrowthBook after lecturer identity resolves and keeps header, course, evaluation, practice-quiz, and microlearning analytics affordances visible but disabled when the flag is false.
- **Tests**: The feature-access Playwright matrix varies GrowthBook and `privatePreview` independently; the shared fixture preserves the existing analytics-enabled test baseline for unrelated suites.
- **Verification**: `agent-browser` confirmed disabled and enabled header, course, and published-microlearning action states in the real local Manage/Auth/API/DB path; enabled navigation reached the course performance dashboard.
