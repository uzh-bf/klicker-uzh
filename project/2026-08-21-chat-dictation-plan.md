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
- 2026-08-21 — The clean branch fast-forwarded from `df10f524e` to the fresh
  `origin/v3` tip `f58986faa` and the plan was committed as `27a2d5d76`.
- 2026-08-22 — Two exact-worktree `devrouter ensure` attempts reached
  `devpod up` but hung in the DevPod SSH helper without routes or a usable
  container. The exact runtime was stopped through `devrouter stop` with
  `stopped: true` and zero freed routes; repository-native checks remain
  pending. A host-side `pnpm --filter @klicker-uzh/chat test:run` attempt then
  auto-created ignored dependencies under Node 26 and failed before collection
  for 34 suites because the built `@klicker-uzh/util` entry was absent; that
  result is not accepted as repository verification.
- 2026-08-22 — A bounded retry found the exact DevPod workspace `NotFound`, but
  `devrouter ensure` stopped before startup because its lifecycle lock could
  not identify the process owner; the suggested workspace garbage collection
  was not run because it is outside this package's approved cleanup scope.
- 2026-08-22 — Read-only inspection found two stale-looking DevRouter candidate
  lock files for dead process IDs `16591` and `35298`. The files were not
  edited or removed; DevRouter's own lifecycle command remains the only
  permitted cleanup path.
- 2026-08-22 — Static contract review extended capability handling for the
  browser's `downloading` result, added the settings-panel install entry
  point, added explicit microphone-permission copy, and made listening state
  changes announce through the composer control. A second pass now ignores
  stale recognition events after cancellation or a replacement session and
  keeps the first-use explanation to two sentences. These edits remain
  unverified and uncommitted. Fake coverage now exercises the settings-panel
  install link, a browser-managed download, failed installation, local-service
  rejection, final text after end, and desktop embed exclusion independently
  of mobile exclusion.
- 2026-08-22 — The exact DevPod ran chat typecheck, lint, unit tests, and
  Playwright typecheck after implementation. Chat unit tests passed with 39
  files and 339 tests. The root `check:all` run remained non-green because the
  analytics lint environment could not build its pinned pandas dependency
  without a compiler; an earlier attempt also caught a dictation-hook lint
  issue, which was fixed and passed in the focused rerun.
- 2026-08-22 — A trusted fallback review found and the implementation fixed
  thread-switch session leakage, final-result/end ordering, browser-managed
  download polling, draft-whitespace loss, and missing visible/error
  announcements. The findings and resolutions are recorded in
  `project/_local/reviews/2026-08-22-dictation-fallback-review.md`.
- 2026-08-22 — Fake-backed `agent-browser` verification covered the English
  install sheet, explicit no-auto-start, listening, draft projection,
  permission error, and German unavailable state. The focused Playwright run
  remains blocked by the exact runtime's missing Chromium headless-shell
  binary, so no positive real-device support claim is made.
- 2026-08-22 — The approved exact workspace GC found no eligible cleanup
  candidates. The exact runtime stop returned a DevPod zombie-container error,
  but readback reports `Stopped` with zero routes; no worktree or branch was
  deleted.
- 2026-08-22 — Follow-up review found one remaining thread-switch defect:
  resetting dictation could leave capability at `unsupported` until reload.
  The thread-change effect now rechecks capability, and the regression test
  asserts that the desktop control returns on the target thread. Exact-container
  chat check, lint, unit tests (39 files, 339 tests), Playwright typecheck, and
  Markdown/Playwright formatting checks pass. The focused Playwright run still
  cannot launch because the container lacks Chromium headless-shell.
- 2026-08-22 — The integrated final review produced five findings. Four were
  fixed in the working tree: composer input is read-only during active
  listening, availability-check failures now route to a distinct localized
  retry action, and the combined mobile/embed exclusion test was split into two
  independent negative tests. The focused Playwright gate ran inside the exact
  container with a system Chromium headless-shell substitute after the
  Playwright CDN returned server errors for build 1208; three tests passed,
  including both split exclusion tests, but the remaining nine timed out behind
  a persistent "Loading chatbot..." screen caused by incomplete client-side
  hydration in this DevPod environment. The hydration blocker is environmental,
  not introduced by this package: chat unit tests (39 files, 339 tests),
  typecheck, lint, Playwright typecheck, and formatting all pass on the
  corrected range.
- Historical checkpoint (superseded): S1-S3 corrections were committed
  locally at the `local_committed` terminal condition with the E2E hydration
  limitation recorded above; push and PR have since been authorized by the
  user (see the 2026-08-22 entry below). Merge, deployment, and positive
  real-device proof remain withheld.
- 2026-08-22 — After the user asked for a ready PR, the branch was pushed and
  PR #5477 opened. Two CI rounds failed on Playwright shard 5 only. Trace and
  video analysis showed every authenticated chat-page test hanging on the
  `chat-loading` skeleton because the navigation helper only waited for
  domcontentloaded, plus one real interaction bug: a successful install left
  the sheet open over the composer, blocking input. The sheet now auto-closes
  when status becomes ready, and `visitChat` waits for the loading skeleton to
  clear (commit 563aa44f9). Chat typecheck passes locally; exact-head CI run
  32592267409 is pending at time of writing. Merge remains withheld.
- 2026-08-23 — Run 3 (32592545633) artifact analysis split the remaining
  failures into two real bugs plus one environmental stall: the install sheet
  rendered with no test id at all because the design-system Modal only
  applies its `data={{ cy }}` prop (a bare `data-cy` is dropped), so the
  sheet locator could never match; aborting dictation on thread switch
  cleared hook refs but left the old draft in the composer, which now resets
  the composer via `aui.composer.reset()`; and the loading skeleton stall is
  a hydration race where the disclaimer API answers in ~20 ms while React
  never finishes hydrating under CI load, so `visitChat` falls back to one
  reload when the skeleton has not cleared. Chat typecheck, unit tests, lint,
  and formatting pass locally. Merge remains withheld.
- 2026-08-23 — Round 4 rerun of the failed shard (run 32604558704, attempt 2)
  reproduced the crash cascade: all 80 failures are Y-chat tests hitting
  `page.reload: Page crashed` at the `visitChat` recovery line, while the
  other seven shards and every non-Y-chat test on this shard pass. The same
  shard file set passed on another branch minutes later, so the trigger is
  runner-load renderer crashes amplified by `page.reload`, which throws when
  the renderer is dead. The recovery now performs a full `goto` instead of
  `reload`; Playwright can navigate to a crashed page but cannot reload it.
  Chat-side checks stay green locally. Merge remains withheld.
- 2026-08-23 — Trace/video analysis of run 32609248151 plus a local
  production-mode reproduction identified the recurring shard-5 crash as
  per-shard browser overload rather than an infrastructure OOM problem: the
  whole Y-chat spec (about 96 tests after this branch) ran serially in one
  Playwright worker/browser, and the added dictation tests pushed that worker
  past a renderer-stability edge. The same test passes locally in 3 seconds
  against a production-mode chat build, and the trace shows no app API call
  before the renderer dies during recovery navigation. Fix: split the
  dictation describe block and its helpers into
  `playwright/tests/Y-chat-dictation.spec.ts` so the shard balancer packs the
  two chat files onto different shards under the checked-in timings. Commit
  6f6f65ae1 passed the full pre-commit suite (gitleaks, check:all) and is
  running as exact-head CI run 32616086751. Merge remains withheld.

## Pause and finish boundary

- Stop if W0 evidence is reinterpreted as positive support, if a recogniser path
  can send microphone audio off-device, if audio or transcript provenance is
  persisted, or if mobile/embed controls become visible.
- Stop at `local_committed` even when all fakes pass if the real manual gate is
  unavailable. Phase 5 roadmap reconciliation is a separate roadmap-only
  transaction after the package reaches this terminal state.
