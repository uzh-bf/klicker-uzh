## 2026-08-03

- **Fix batch**: the production-readiness fixes landed
  (branch `claude/chat-v3-6-fixes`). The backend ConfigMap now receives
  `CHAT_MODEL_REGISTRY_JSON` from the same source as the chat pod, with a
  parity vitest over the two built-in defaults (P1-1); the `apps/chat`
  vitest suite runs in CI via the new `test-chat.yml` (P1-2) —
  [chat-platform](../chat-platform.md) and [testing](../testing.md) updated
  accordingly. In `apps/chat`: `onEnd` returns early after an abort so the
  partial answer and its per-step credit charge survive a cancel, and
  `onAbort` persists completed tool steps when nothing streamed yet (P2-1),
  the assistant avatar `<Image>`s are unconditionally `unoptimized` so the
  SVG fallback no longer 400s (P2-2), `formatCredits` no longer strips
  significant zeros ("10" stayed "10"; extracted to
  `thread-credits-format.ts`), `creditsLoaded` is sticky across refreshes,
  the dead `data-cy` fallback is reachable again, `SAFE_TOOL_ERROR` is
  defined once, and a locale-parity vitest pins en/de key trees (with
  allowlisted pre-existing gaps) plus chat-namespace ICU placeholders.
  Prd values disable the chat telemetry wrapper until the OTel bump (P2-3).
  Playwright `Y-chat.spec.ts` gains coverage for the five manually-verified
  surfaces (caption metadata, error/truncation callouts, rating persistence
  across reload, the feedback route's cross-participant 404, reasoning-effort
  end to end) plus live-streamed citations; `makeStreamBody` now emits finish
  `messageMetadata`, tool events, and SSE errors (P2-4/P3-9 — first live run
  happens in CI, since the local globalSetup would wipe the dev database).
