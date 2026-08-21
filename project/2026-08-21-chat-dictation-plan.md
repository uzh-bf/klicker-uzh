# W3 Dictation in Chat — Execution Plan

Date: 2026-08-21. Branch `feat/chat-dictation`, worktree
`/Users/rschlae/Git/klicker/klicker-uzh/trees/feat-chat-dictation`, target
`v3`. This plan covers W3 of the approved chat voice roadmap.

## Goal and non-goals

- **Goal:** let a desktop browser that exposes the proven on-device Web Speech
  contract dictate a message into the existing chat composer while preserving
  typed-text review, the existing draft, localized errors, and the existing
  disclaimer/data boundary.
- **Non-goals:** cloud recognition, browser ML, stored audio, a dictated-message
  flag, usage telemetry, mobile dictation, embedded-mode dictation, voice mode,
  read-aloud changes, or a positive real-device support claim not proven by W0.

## Execution contract

- **Execution owner:** the current main session owns integration, verification,
  local commits, runtime cleanup, and the final boundary review. A native
  executor may own only the bounded S1/S2 implementation slices after plan
  approval; the main session owns the cross-provider composer/browser seam in
  S3.
- **Boundary owner:** `self`. No active `rs-roadmap-orchestrator` handoff or
  live task owns this roadmap; the roadmap owner remains a separate worktree.
- **Authority granted by approval:** fast-forward the clean task branch to the
  fresh `origin/v3` ref, commit this plan, edit the named W3 files, run the
  repository checks and fake-browser evidence, run configured local reviews,
  make local conventional commits, and stop the exact local runtime.
- **Withheld:** push, PR creation or update, CI, merge, deployment, secret
  changes, production access, and positive real-device install/transcription
  proof.
- **Terminal:** `local_committed` on `feat/chat-dictation` with fresh checks,
  fake-browser EN/DE evidence, negative-only W0-compatible manual evidence,
  required reviews resolved, a clean task worktree, and the exact runtime
  stopped and verified.
- **Pause:** stop before any cloud or persisted audio path; stop if the branch
  cannot fast-forward cleanly; stop if a required check or review cannot run;
  stop before claiming a supported browser or PR-ready delivery layer.

## Freshness and ownership evidence

- `git fetch origin v3` was attempted but cannot write `.git/FETCH_HEAD` in the
  shared checkout. `git ls-remote origin refs/heads/v3` returned
  `f58986faa8cfa4ff78d20a1ebeb1666473343d38`; the clean task branch currently
  points at `df10f524ecf453fe2f43a3b08797a590f962c191` and is four commits
  behind that remote ref. Rebaseline with `git merge --ff-only origin/v3`
  immediately before the plan commit.
- The canonical roadmap is the untracked file in the sibling worktree
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/chat-voice-interface-roadmap/project/2026-08-21-chat-voice-interface-roadmap.md`.
  Do not edit or copy that sibling's untracked files from this worktree;
  Phase 5 owns the roadmap-only Progress reconciliation after this package.
- Accepted ADR 0026 exists in the reviewed roadmap/W1 history at commit
  `6be50dfeb` but is not present on current `origin/v3`. W3 does not create a
  second ADR or alter the sibling file. The implementation docs must not add a
  broken link to the absent file; reference the accepted privacy contract in
  this plan and let the package that carries ADR 0026 provide the durable link.

## Research

- **Repository evidence:** the roadmap W3 contract is the binding product
  specification. `apps/chat/src/app/RuntimeProvider.tsx` owns the
  `AssistantRuntimeProvider`; `thread.tsx` owns the normal composer and
  `AttachmentErrorBanner`; `settings-panel.tsx` is sidebar-only; the locale
  catalogs are `packages/i18n/messages/en.ts` and `de.ts`; pure chat tests run
  in Node without jsdom; Playwright coverage lives in
  `playwright/tests/Y-chat.spec.ts`.
- **API evidence:** assistant-ui's context API documents reading
  `composer.text` with `useAuiState` and writing/sending through
  `useAui().composer.setText()` and `.send()`. The current package pins
  `@assistant-ui/react` 0.15.1; use the existing runtime seams rather than a
  second input state.
- **W0 evidence:** macOS Chrome 151 on trusted HTTPS exposed local German and
  English synthesis voices, but `available({ de-DE, en-US, processLocally:
  true, quality: 'dictation' })` returned `unavailable`, `install()` returned
  `false`, and the dictation probe returned `language-not-supported`. Every
  other device row is blocked. This is enough to implement and test the
  capability state machine and negative UI; it is not positive browser support
  evidence.

## Decisions and risks

- Dictation capability is session-local. Do not persist capability, install
  progress, audio, or transcript provenance in `settings-storage`.
- Mobile is classified from observable browser data and is `unsupported` for
  v1 even when a mobile Chromium build exposes recognition. Embedded mode hides
  the control and does not start recognition.
- The hook must call the exact on-device API options, set
  `processLocally = true` before every start, expose only boolean install
  completion, and re-check availability before exposing Start dictation.
- The existing draft is never replaced. Interim text is projected after one
  separator, final text remains in the composer after `end`, and abort/no-speech
  restores the captured draft. Starting dictation synchronously cancels local
  read-aloud playback.
- The W0 dependency is classified as **flow-observed but not positively
  proven**: the explicit availability → install → result → re-check path ran,
  but no pack became available. The package therefore remains
  `delivery_pending` for positive real-device proof and makes no allowlist or
  support claim.

## Primitive impact and ADR gate

- Student message: reuse the ordinary text composer; no schema, provenance, or
  dictated flag change.
- Device-local settings: no new persisted setting in W3; capability is runtime
  state only.
- Audio/data boundary: microphone audio is processed only through the local
  browser contract; the final transcript follows the existing typed-text path
  and disclaimer. ADR 0026 remains the accepted source of rationale; no new
  ADR is warranted unless the implementation changes that boundary.

## Test portfolio

| Risk or behavior | Obligation | Primary seam | Distinct failure protected | Owner |
| --- | --- | --- | --- | --- |
| Capability and error transitions | add new | `apps/chat/src/lib/speech/dictation-state.ts` reducer tests | an API result or mapped error leaves the UI in the wrong state | S1 |
| Draft append/restore and recognition lifecycle | add new | pure draft projection helpers plus Playwright fake | interim text overwrites a student's existing draft or abort loses it | S3 |
| Browser/mobile/embed visibility | extend existing | Playwright fake with user-agent/context overrides | microphone appears or starts where v1 forbids it | S1 |
| Install sequencing | add new | Playwright fake `downloadable → installing → available` | asynchronous install auto-starts or skips the re-check | S2 |
| Localized status and error copy | extend existing | EN/DE Playwright settings and composer states plus locale parity | missing or English-only copy reaches German UI | S1/S3 |
| Playback cancellation | add new | fake synthesis spy in Playwright | dictation records while read-aloud continues | S3 |
| Real-device capability | no new automated test; manual negative evidence only | W0 record | a local fake is mistaken for a supported browser | main/final gate |

## Delegation Map

- **S1 — capability shell:** native `executor` after plan approval. Depends on
  branch rebaseline. Acceptance is reducer coverage plus fake-browser evidence
  for constructor absence, mobile, embedded, unavailable, and all status-line
  states.
- **S2 — explicit install sheet:** native `executor` after S1. Acceptance is
  the scripted `downloadable → installing → re-check → ready` flow with no
  automatic start and indeterminate progress.
- **S3 — draft-safe recognition and integration:** `main`. It crosses
  assistant-ui composer state, browser audio, accessibility, and final
  integration; execution-tier skip reason: critical-path coupling and privacy
  boundary. Acceptance is the complete fake-backed recognition flow, mapped
  banners, playback cancellation, docs, checks, and screenshots.

## Slices

### S1 — Honest capability shell

- **Do:** add the pure reducer and local structural recognition types; add the
  `useDictation` capability classifier and a runtime context/provider inside
  `AssistantRuntimeProvider`; wire the provider from `RuntimeProvider`; add the
  session-local settings status line, mic visibility/disabled semantics, and
  EN/DE status labels. Keep `settingsStore.ts`, `chat-ui-context.tsx`, and
  `disclaimer-modal.tsx` unchanged except where their existing APIs are
  consumed.
- **Files:** new `apps/chat/src/lib/speech/dictation-state.ts` and tests;
  new hook/context files under `apps/chat/src/hooks/` or
  `apps/chat/src/components/`; `apps/chat/src/app/RuntimeProvider.tsx`;
  `apps/chat/src/components/thread.tsx`; `apps/chat/src/components/settings-panel.tsx`;
  `packages/i18n/messages/en.ts`; `packages/i18n/messages/de.ts`;
  focused Playwright setup/spec additions.
- **Check:** reducer tests; fake constructor-absent, mobile, embedded,
  unavailable, and settings-state tests; package typecheck and focused
  Playwright test. Commit:
  `feat(chat): add local dictation capability states`.

### S2 — Explicit first-use installation

- **Do:** add `apps/chat/src/components/dictation-sheet.tsx` using the existing
  `Modal`/button primitives. Show equal-weight Download/Not now actions,
  indeterminate installing state, boolean install result, availability
  re-check, and explicit Start only after `available`. Map install exceptions
  and false results without auto-starting.
- **Check:** Playwright fake covers sheet on `downloadable`, installing state,
  re-check, ready/listening transition, false/exception outcomes, and no
  automatic start. Commit:
  `feat(chat): add on-device dictation setup`.

### S3 — Draft-safe recognition and package finish

- **Do:** configure the recogniser with locale-derived `de-DE`/`en-US`, local
  processing, non-continuous interim results, and one alternative; append
  interim/final results through assistant-ui; capture/restore drafts on abort
  and no-speech; map `not-allowed`, `service-not-allowed`,
  `language-not-supported`, and other specified errors through the existing
  composer error banner; cancel `speechSynthesis` on start; add the mic button
  beside the attachment button with 44 px touch target, visible listening
  label, `aria-pressed`, tooltip, and `data-cy="chat-dictation"`; extend the
  Voice section of `docs/chat-platform.md` without adding an ADR link absent
  from the target branch.
- **Check:** fake-backed Playwright tests for draft preservation, interim/final
  composer state, Send enablement, mapped banners, playback cancellation,
  embed exclusion, and EN/DE status; `pnpm --filter @klicker-uzh/chat
  test:run`; chat check/build; Playwright check and focused dictation run;
  `pnpm run check:all`; fake-backed EN/DE screenshots; manual Chrome 151
  negative unavailable-state evidence only. Commit:
  `feat(chat): add draft-safe chat dictation`.

## Verification and review cadence

- Use the self-contained devrouter environment for all Node, pnpm, Playwright,
  and browser checks; read `$rs-local-runtime-lifecycle` before starting and
  after the final runtime-dependent check. Do not start the host secret-injected
  stack or use real transcripts.
- Before each slice commit, run the fastest focused tests, inspect staged
  content for secrets/PII, and run `$verification-before-completion` evidence.
- Each substantive slice requires the configured `simplifier`; each slice's
  privacy/browser/data-flow risk requires one `slice-reviewer` covering privacy,
  accessibility, correctness, and architecture. Persist reports under
  `project/_local/reviews/` and apply accepted findings before the next slice.
- After S3, run the full fresh checks, capture fake-backed EN/DE states through
  `npx agent-browser`, stop and verify the exact runtime, commit the complete
  local branch, then run one integrated `final-reviewer` over the full range.
- Do not call the branch `pr_ready`, `merged`, `released`, or `live_proven`.
  The real positive install/transcription gate remains `delivery_pending`.

## Progress

- 2026-08-21 — Planner pass returned `DONE_WITH_CONCERNS`. Accepted concerns:
  rebaseline the clean branch before the plan commit; keep ADR 0026 ownership
  separate from the sibling roadmap worktree; record W0 as negative/flow-only
  evidence; use a single provider under the assistant-ui runtime; and keep
  positive real-device support withheld.
- Current status: plan draft awaiting user approval. No implementation files,
  commits, publication, or runtime changes exist on this branch.

## Pause and finish boundary

- Stop if W0 evidence is reinterpreted as positive support, if a recogniser path
  can send microphone audio off-device, if audio or transcript provenance is
  persisted, or if mobile/embed controls become visible.
- Stop at `local_committed` even when all fakes pass if the real manual gate is
  unavailable. Phase 5 roadmap reconciliation is a separate roadmap-only
  transaction after the package reaches this terminal state.
