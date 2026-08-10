## 2026-08-03

- **Update**: production-readiness documentation pass over the chat stack.
  [chat-platform](../chat-platform.md) replaces the wrong PRD Auto tier map with
  the one recorded in `deploy/env-uzh-{stg,prd}/values.yaml`
  (SIMPLE=`gpt-4.1`, MEDIUM=`gpt-5.4-low`, COMPLEX=`gpt-5.4-medium`,
  REASONING=`gpt-5.5-low`), states that the authoritative LiteLLM router config
  lives in the external AI deployment repository and is unverifiable from here,
  and marks the local `util/litellm/config.yaml` simulation as deliberately
  different (GPT-5.6 Luna/Sol) rather than evidence of production routing. The
  same page re-scopes its migration banner — the AI-SDK route-handler layer is
  the production path per [ADR 0003](../adr/0003-chat-framework-upgrade.md),
  with the Mastra service split left as an open exploration — extends the
  Structure map with `lib/sources/`, `lib/config/`, `remarkCitationMarkers.ts`,
  `toolOutput.ts`, `lib/attachments/`, `ratingRequestCoordinator.ts` and
  `components/ui/`, documents the `null`-means-never credit reset and the
  footer's absent-until-loaded state, the `public/` middleware allowlist, the
  mid-thread mode-switch contract and single-mode hiding, the write-only status
  of ratings, and the fact that the chat vitest suite runs in no CI workflow.
  [architecture-overview](../architecture-overview.md) gets the matching banner
  re-scope. [testing](../testing.md) corrects the chat command to
  `pnpm --filter @klicker-uzh/chat test:run` and records the missing
  `test-chat.yml` as a named follow-up.
  [ci-and-deployment](../ci-and-deployment.md) records the SonarCloud
  copy-paste exclusion for `packages/i18n/messages/**`.
  [getting-started](../getting-started.md) notes the `['**.localhost']`
  `allowedDevOrigins` glob and its silent non-hydration failure mode.
  [index](../index.md) now points at [the ADR directory](../adr/), and
  chat-platform links ADR 0001 from localization and ADR 0002 from message
  feedback. `.agents/skills/klicker-testing-verification/SKILL.md` carries the
  corrected chat command and the local-versus-deployed routing caveat.

- **Catch-up**: earlier changes from this stack that never reached this log —
  the [getting-started](../getting-started.md) rewrite covering Turborepo strict
  environment mode, the new solution page
  [next-build-inherits-development-node-env](../solutions/build-error/next-build-inherits-development-node-env.md),
  and the creation of [ADR 0001](../adr/0001-chat-locale-from-cookie.md) and
  [ADR 0002](../adr/0002-message-feedback-as-a-rating-field.md).
