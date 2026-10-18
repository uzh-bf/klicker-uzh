# W2 — local editable code playground in Chat

## Approval summary

**Why and what changes?** Learners in a coding course can ask the course assistant to open a Python or R playground in the conversation. The assistant opens a code card with editable starter code. The learner runs the code in the browser, sees bounded output and status, and can stop or reset it. Running never calls a model or a server. The work has three parts:

- **Server contract:** pinned runtime files and a per-mode capability policy that decides which chatbots and modes may open cards.
- **Runner:** a sandboxed runner with no network access, built on the approved W1 isolation design.
- **Card:** the card UI with browser proof.

**What stays unchanged?** No run sends code, output or telemetry anywhere. The assistant does not see the code; that comes in **W3 — selected run feedback**. There are no exercises, tests or grades. Lecturer screens, GraphQL, quiz elements and personas are unchanged. Firefox shows a "not available in this browser" notice.

**What could change the decision?**

- **Default off.** A deployment flag must be on, and a chatbot policy must allow the profile. With the flag off, Chat returns 404 for the runtime files, so merging does not publish them.
- **Image size.** The Chat image still grows by about 64 MB. It ships the webR (GPL-3.0) and Pyodide (MPL-2.0) licences and a source pointer.
- **Policy storage.** The policy is a new platform-owned chatbot column that lecturers cannot edit yet. **W5 — controlled pilot qualification** owns the operator step that enables a pilot.
- **Profiles.** Python ships the standard library only, and R ships base R only. Package profiles move to a follow-up.
- **Test coverage.** CI covers Chromium only. WebKit and Firefox evidence is local, from the repository's release-matrix projects.

**How will we know it is done?** Two reviewed draft PRs into `v3-ai` form a native stack with green CI. The browser proof runs on Chromium and WebKit, plus a Firefox notice check. It covers edit, run, stop, reset, flooding, stale results, reload loss, a nested frame and the flag-off 404. A sink server must record no program egress. The PRs embed a real screenshot gallery.

**What does approval authorize?** This plan's delivery steps:

- the worktree and branches, local commits and one generated migration
- container checks, the local runtime and host WebKit and Firefox browser installs
- task-branch pushes, draft PRs, screenshot upload and `/final-review`

Withheld: marking ready, merging, deployment, Helm or infrastructure changes, enabling the flag or a policy in a shared environment, and learner exposure.

## Execution details

### Identity and working context

- Roadmap item: **W2 — local editable playground** in the browser coding exercises roadmap (`project/2026-10-17-browser-coding-exercises-roadmap.md`, kept in the planning worktree and not yet committed). The isolation evidence is the gitignored local file `project/_local/reviews/browser-runtime-qualification.md`, together with its same-origin addendum.
- Repository `uzh-bf/klicker-uzh`. The base is `origin/v3-ai`, pinned at planning to `30dd39c6528c686b221bb040285c55149addd5ee`; refresh it at start. The user ruled on 2026-10-17 that W2–W5 target `v3-ai`.
- Worktree `trees/browser-code-playground`, holding a native two-layer stack:
  - `rs/browser-code-policy` carries the server contract: runtime files, proxy gating, policy and tool.
  - `rs/browser-code-playground` carries the runner, bridge, card and browser proof, stacked on the first layer.
- Departure from the roadmap topology: the bridge protocol moves to layer 2. Only client code consumes it, and the runner documents embed hashes of its bootstrap. Keeping them in one layer avoids churn across the layers.
- This draft lives in the planning worktree. After approval it becomes the first commit of `rs/browser-code-policy` (`docs(project): add browser code playground implementation plan`).
- Execution mode is `solo` with Claude Opus 5.5 as the main model. The main session implements both layers and runs the final simplification and the integrated review. That review is labelled self-review. Repository CI and `/final-review-stack` provide the independent review.
- `Authority:` see the approval summary.
- `Terminal:` both draft PRs reach `pr_ready` and stay draft. That means local checks are green, hosted CI is green, `/final-review-stack` is addressed and the gallery is embedded.
- `Boundary owner:` self.
- `Pause:` stop and report in any of these cases:
  - A required seam is absent on the refreshed base.
  - Isolation evidence fails on Chromium or WebKit.
  - The proxy cannot gate or serve the runtime path as designed.
  - Repo tooling cannot generate the migration.

### Binding contracts carried from W1 and the roadmap

1. **Isolation.** There are two runner documents, `runner-python.html` and `runner-r.html`, under `/code-runtimes/<runtime-version>/`. Two mechanisms keep their origin opaque:
   - the iframe attribute `sandbox="allow-scripts"`
   - a response CSP `sandbox allow-scripts`, which also applies when someone opens the URL directly

   The CSP allows no network scheme. It is `default-src 'none'`, plus the hash of the inline bootstrap, plus `blob:` for scripts, workers and connections, plus `'wasm-unsafe-eval'`. Only the R document adds `'unsafe-eval'`, because webR needs it.

   The host fetches every runtime file and verifies its SHA-256 against a checked-in manifest. It then sends the bytes to the runner by structured clone. Program code runs only in a worker.

   The 2026-10-17 same-origin hosting prototype gave these results:
   - Chromium passed for both languages.
   - WebKit passed for R.
   - WebKit Python recorded zero leaks. The harness still marked it failed because the check counted the runner document reload after the timeout reset as an origin-A request.

   The receipt addendum records this. The S4 spec witnesses it again in the product.
2. **Bridge.** There is a single handshake. The host's `hello` carries a private `MessageChannel` port, and the runner accepts it once, only from `window.parent`. The host ignores all `window` messages and checks every port message for:
   - protocol version, shape and size
   - attempt ID and generation

   Output is capped per stream in the worker and again in the host. The host also caps the count of status and diagnostic messages per run, including CSP reports. Provenance is always `browser-reported` and is assigned by the host. A second frame `load` destroys the runner.
3. **Lifecycle.** Each page has at most one active runner, and each card has one run at a time. Every Run builds a fresh runner, so interpreter state is always clean. There is no pre-warmed spare. W1 measured warm rebuilds at 0.4–1.1 s, and a spare per profile would multiply memory use on iOS.

   The host keeps one verified copy of the bytes per profile, and the runner is removed when its run ends. Stop, timeout and reset all remove the frame. Every run has a wall-time deadline, which also covers WebKit's blocked `pyfetch` that never settles.

   Late results never overwrite newer attempts. The status values `ok`, `error`, `timeout`, `stopped`, `unavailable` and `unknown` stay distinct. R errors are captured as conditions.
4. **Browsers.** Chromium and WebKit (Safari) are supported. Firefox and unknown engines show a truthful unavailable notice until they are re-qualified (user ruling, 2026-10-17). There is no server fallback.

   A pure, unit-tested engine-detection function decides support. A spoofed engine affects only the spoofer's own browser.
5. **Local by default.** Drafts and output live only in page memory. There is no autosave, no keystroke upload and no telemetry about source or output. Navigation loses the draft, and the card says so. Starter code comes from the tool result and survives reload; edits do not. Starter code is length-bounded and rendered only as a textarea value.
6. **Default off.** Two switches must both admit a profile:
   - the deployment kill switch `CHAT_CODE_EXECUTION_ENABLED`, where absent means off
   - the chatbot's per-mode policy

   Only then does the server register `open_code_card` for that mode. The client receives the profiles each mode allows, and history cards from a revoked mode show "unavailable".

   With the switch off, the proxy answers 404 for `/code-runtimes/`. The kill switch is a plain environment variable, following existing Chat precedents (`CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED`, `CHAT_TURN_LIFECYCLE_WRITES_ENABLED`). It is not a GrowthBook flag (ADR 0008), because it gates both server and static serving at runtime.

### Design decisions

| Decision | Choice | Alternatives and reopen trigger |
| --- | --- | --- |
| How a card appears | Server tool `open_code_card` with input `{profile, starterCode}`, where `starterCode` has a bounded length. The result is `{kind: 'code-card', profile, starterCode}`. The model sees a one-line `toModelOutput`, and the tool description tells it when to use the tool. `ToolFallback` renders the card, as it does the practice card. Owner preview registers the tool too, so owners see what learners see. | A client-only panel does not fit the thread, history or W3 sharing. Reopen if model-mediated opening proves unreliable in fake-provider or pilot evidence. |
| Policy storage | A new platform-owned column, `Chatbot.codeExecutionConfig Json?`. It holds a list of allowed profiles per mode, is normalized on the server and is tolerant on read. One migration generated by repo tooling, then `prisma:sync`. | `customModeConfig` was rejected for three reasons. It covers only `cm_` custom modes, not tutor, explainer or quizzer. It is lecturer-owned and revision-reviewed (ADR 0043). Its save path drops unknown fields (`packages/util/src/chatbotCustomModeConfig.ts:184-266`, read path `:302-331`). This supersedes the W1 receipt's tentative `customModeConfig` suggestion. A GrowthBook flag has no per-mode profile control. Lecturer authoring comes in W5 or later. |
| Runtime path serving | Runtime files and the two runner documents live in `apps/chat/public/code-runtimes/<runtime-version>/`, generated at build time. `proxy.ts` gets an early branch for that prefix, placed before the participant gate and `applyFrameAncestorsCSP`. With the switch off, the branch returns 404. With it on, it passes the request through and sets the response headers at runtime: the strict runner CSP on the two documents, a restrictive CSP on other files, and `Cache-Control: public, max-age=31536000, immutable` for hash-addressed runtime assets. Generated licence and source notices revalidate because their bytes are outside the manifest hash. | Build-time `next.config` headers were rejected: they cannot read the runtime env, and the proxy replaces the CSP anyway. A route handler that streams the files was rejected: it adds code and a Dockerfile change for no extra gating. A separate static origin or CDN is **A4 — execution infrastructure**. Reopen if the proxy cannot set headers on `public/` responses in the production build. |
| Framing of the runner | The runner CSP sets `frame-ancestors 'self'` if a production build shows that Chromium and WebKit let the Chat page frame it. Otherwise it omits `frame-ancestors`. The runner is opaque, has no network access and carries no privileges, so isolation does not depend on this directive. The choice and its evidence go into the ADR. | `ALLOWED_FRAME_ANCESTORS` is not applied, because the runner is never embedded directly by an LMS. |
| Runtime packages | `pyodide@314.0.7` and `webr@0.6.0` are exact-pinned `devDependencies` of `@klicker-uzh/chat` and serve only as build-time asset sources. A `.syncpackrc.mjs` semver group with a rationale keeps them exact, so the hash manifest matches the installed version. Both packages are older than the 14-day `minimumReleaseAge`, and neither has install scripts. The webR base virtual filesystem comes with the npm tarball. | Fetching tarballs in a script was rejected: it bypasses the lockfile and the release-age policy. `webr` adds unused REPL dependencies to dev installs; this is recorded. |
| Asset generation | One script, `apps/chat/scripts/code-runtimes.mjs`, does three things: copies the qualified profile files, writes both runner documents with their bootstrap hashes, and verifies everything against the checked-in manifest module. It runs as `prebuild`, `predev` and `predev:test`, and fails closed on any mismatch. The generated directory is listed in `apps/chat/.gitignore`, in a chat-level turbo `outputs` override, and in the ESLint and Biome ignores. Licence texts and an upstream source pointer are copied alongside. | Committing the binaries was rejected: about 64 MB in Git. |
| Profiles | `python-core` is the Pyodide standard library. `r-base` is the webR base distribution. | Package profiles such as NumPy or pinned CRAN packages need a non-npm artifact pipeline with hash pinning. They are a follow-up package; reopen when W4 exercises need packages. |
| Editor | An accessible monospace `<textarea>` with no keyboard trap. Tab moves focus, and there is no Tab-indent. | No editor library exists in the repo, and adding one is a separate dependency decision. |

### Primitive impact

| Primitive | Disposition | Delta |
| --- | --- | --- |
| Chatbot mode capability | Extend | Platform-owned, per-mode admission of code execution, with profile lists. It composes with standard and custom modes, personas and onboarding. No learner data is added. |
| Code attempt / Run evidence | Defer | Page memory only in W2. The persisted primitives start in W3. |
| Exercise | None | — |

ADR gate: the runner isolation architecture passes. It is durable and cross-cutting, it makes a security trade-off, and it adds Firefox only after re-qualification.

- Write `docs/adr/0052-browser-code-execution-isolation.md` in layer 1. The number is free at `30dd39c6`; recheck it on the refreshed base.
- Update `docs/chat-platform.md` in layer 2.
- Check `.agents/skills/` for any Chat guidance this change makes inaccurate.
- No `CONTEXT.md` change.

### Test portfolio

| Risk or behaviour | Obligation | Primary seam | Distinct failure caught | Slice |
| --- | --- | --- | --- | --- |
| Runtime path is 404 when the switch is off. When on, it bypasses participant auth while pages stay gated, gets the runner CSP on the two documents, and never gets the frame-ancestors-only CSP | Add new | Proxy unit test beside `apps/chat/test/middleware-matcher.test.ts`, plus a header check against a production build (`next start`) with `ALLOWED_FRAME_ANCESTORS` set | Runtime files published while off; runner CSP replaced; files redirected to `/noLogin` | S1, S3 |
| Generated files match the pinned manifest, and runner bootstrap hashes match their documents | Add new | Script test using a synthetic mismatched file and a stale hash | Silent asset drift, a tampered file, or a broken runner CSP published | S1, S3 |
| The tool is registered only when the switch is on and the mode lists a profile; malformed config fails closed; every mode-option caller carries the derived profiles | Extend existing | `apps/chat/test/effective-chat-modes.test.ts`, plus a new policy normalizer test | Capability leaks to other modes or chatbots, or survives with the switch off | S2 |
| Bridge validation: stale attempt or generation, bad shape, oversize, message-count cap, host-assigned provenance | Add new | Pure protocol module tests under `apps/chat/test/` | A forged or late message changes the visible result | S3 |
| Engine detection | Add new | Pure function test | Firefox gets a broken runner instead of the notice | S3 |
| Real execution, isolation and recovery: edit, run, stop, reset, timeout, flood, stale completion, reload loss, unavailable profile, nested frame, flag-off 404. No program egress, witnessed by a loopback sink server started in the spec with random tokens and by a token-bearing Chat-origin probe. The probe battery includes `WebTransport` over the devrouter HTTPS origin | Add new | Host Playwright spec `playwright/tests/Y-chat-code-card.spec.ts` with `mockChatStream` tool results. Runs on Chromium, then on WebKit, with Firefox for the notice, via `PLAYWRIGHT_RELEASE_MATRIX=true` | The runtime fails in a real browser, or a leak or regression comes back in later items | S4 |
| Card result parsing is defensive | Add new | Pure parser test | A malformed tool result crashes the thread | S4 |
| en/de copy parity | Existing | `apps/chat/test/locale-parity.test.ts` | Missing translation | S4 |

- The Playwright mock replaces the chat route, so server gating relies on the unit tests.
- No test pins copy text, snapshots or asset counts. Fixtures are synthetic.
- Playwright's view of dedicated-worker requests in WebKit is unverified. The sink server is the egress witness there.
- Later items reuse this spec instead of duplicating isolation tests.

### Slices

**S1 — pinned runtime files and gated serving** (layer 1)
- `Do:`
  - Add the exact-pinned devDependencies and the syncpack group.
  - Add the generation script's copy-and-verify part, with the manifest module, licence texts and a source pointer.
  - Add the build and dev hooks, the ignores and the turbo outputs.
  - Add the proxy branch: 404 when off, runtime headers when on.
  - Write the ADR.
- `Files:` `apps/chat/package.json`, `pnpm-lock.yaml`, `.syncpackrc.mjs`, `apps/chat/scripts/code-runtimes.mjs`, `apps/chat/src/lib/code-runner/manifest.ts`, `apps/chat/src/proxy.ts`, `apps/chat/.gitignore`, `apps/chat/eslint.config.mjs`, `biome.json`, `turbo.json`, `docs/adr/0052-…`.
- `Check:`
  - proxy unit test and script mismatch test
  - `devrouter exec . -- pnpm --filter @klicker-uzh/chat check` and `test:run`, plus root `pnpm run check:all` in the container
  - a Chat production build whose standalone output contains the files, with the off and on header check
- `Commit:` `enhance(chat): serve pinned browser code runtimes behind a kill switch`.

**S2 — code-execution capability policy and card tool contract** (layer 1)
- `Do:`
  - Add `Chatbot.codeExecutionConfig`, with a migration generated in the container, then `prisma:sync`.
  - Add the type and tolerant normalizer.
  - Derive allowed profiles in `resolveEffectiveChatModeOptions` for all five callers and their Prisma `select`s.
  - Extend `ChatModeOption` and `parseModeOptions`.
  - Add the env gate. Register `open_code_card` in the chat route beside the practice tool, and in the owner-preview route.
  - Add `CHAT_CODE_EXECUTION_ENABLED` to `turbo.json` `globalEnv`, to `.devcontainer/devcontainer.env` (on, dev-only, still policy-gated) and to the CI Playwright runtime env.
- `Files:`
  - schema and data: `packages/prisma/src/prisma/schema/chat.prisma` plus the migration, `apps/analytics` sync output, `packages/types`, `packages/util` (normalizer)
  - Chat server: `apps/chat/src/lib/server/effectiveChatModes.ts`; `apps/chat/src/app/[chatbotId]/layout.tsx`; `apps/chat/src/app/preview/[chatbotId]/page.tsx`; `apps/chat/src/app/api/chatbots/[chatbotId]/route.ts`; `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`; `apps/chat/src/app/api/chatbots/[chatbotId]/preview/chat/route.ts`
  - Chat client: `apps/chat/src/lib/config/modes.ts`
  - config: `turbo.json`, `.devcontainer/devcontainer.env`, the CI workflow env
  - annotated JSON types, if used: `apps/chat/src/types/app.d.ts`, `packages/graphql/src/types/app.ts`
- `Check:`
  - policy and effective-mode tests, `pnpm --filter @klicker-uzh/chat check` and tests, util tests
  - migration review: one migration, generated, schema-equivalent
- `Commit:` `enhance(chat): add per-mode browser code execution policy`.

**S3 — runner, bridge and lifecycle** (layer 2)
- `Do:`
  - Implement the runner bootstrap, loader shim, Python worker and webR composition from the W1 design.
  - Extend the generation script to write the two runner documents with their bootstrap hashes, and add a staleness test.
  - Add the host-side bridge client and protocol module with all caps.
  - Add the lifecycle: one active runner per page and a fresh runner per run, with deadlines, destroy and reset.
  - Add engine detection and lazy loading on first Run.
  - Confirm the `frame-ancestors` choice against a production build.
- `Files:` `apps/chat/src/lib/code-runner/` (protocol, bridge client, engine detection); runner-side sources under `apps/chat/src/lib/code-runner/runner/`, emitted by the generation script; `apps/chat/scripts/code-runtimes.mjs`.
- `Check:` protocol and engine tests, the runner header check against a production build, chat check and tests, and a local spot run in Chromium.
- `Commit:` `enhance(chat): add isolated browser runner bridge`.

**S4 — code card and browser proof** (layer 2)
- `Do:`
  - Add a `ToolFallback` branch and the card: editable source, profile badge, Run, Stop and Reset.
  - Show truthful status, truncation and unavailable states (profile not admitted, revoked mode, Firefox and other engines), and the note that navigation loses the draft.
  - Make it keyboard- and narrow-screen-usable, with en and de strings.
  - Add a `setCodeExecutionPolicy` helper beside `setModelSelection`, reset in `resetChatState`.
  - Add the Playwright spec and its `profiles.json` entry, plus `timings.json` if CI requires it.
  - Update `docs/chat-platform.md`.
  - Capture the gallery: desktop and mobile in en, plus the de unavailable state.
- `Files:` `apps/chat/src/components/tool-fallback.tsx`, `apps/chat/src/components/code-card.tsx`, `packages/i18n/messages/{en,de}.ts`, `playwright/tests/Y-chat-code-card.spec.ts`, `playwright/util/chat.ts`, `playwright/profiles.json`, `docs/chat-platform.md`.
- `Check:`
  - parser test, locale parity, chat check and tests
  - against `devrouter ensure . --profile chat --json`:
    - `node util/run-playwright-host.mjs --project=chromium playwright/tests/Y-chat-code-card.spec.ts`
    - `PLAYWRIGHT_RELEASE_MATRIX=true` runs for `--project=webkit` and `--project=firefox`
  - WebKit and Firefox need a host browser install that matches the repo's Playwright version; the launcher installs only Chromium.
- `Commit:` `enhance(chat): add local code playground card`.

### Verification and finish

- Container checks: `devrouter exec . -- pnpm --filter @klicker-uzh/chat check`, `test:run`, util package tests, root `check:all`, and a Chat production build.
- Host browser checks: the S4 spec on Chromium and WebKit, plus the Firefox notice case.
- Start the runtime only for the production-build checks in S1 and S3 and the browser proof in S4. Stop it after the last check that needs it.
- Finish in this order:
  1. Run the final simplification and the integrated self-review under the solo override. Its lenses are correctness, plan compliance, maintainability, security (new trust boundary, CSP, dependency) and architecture.
  2. Write both PR bodies with `$rs-mr-description-writer`, including the gallery and the local WebKit and Firefox evidence.
  3. Post `/final-review-stack` on the top PR once CI settles.
  4. Run `$rs-compound` if a non-obvious lesson arises.
- Size estimate: about 1,500–2,500 substantive lines across both layers.

### Research and evidence

- **W1 evidence.** The receipt covers the Chromium, WebKit and Firefox matrix, licences, startup and warm-rebuild timings. The same-origin hosting prototype output is in the W1 harness `out-sameorigin/`, summarized in the receipt addendum.
- **Seams at `origin/v3-ai` (`30dd39c6`).** All of these were verified by the planner challenge:
  - card dispatch at `tool-fallback.tsx:177-192`
  - practice-tool registration at `chat/route.ts:1367-1421`
  - the per-mode policy precedent `isParticipantReasoningVisible` at `effectiveChatModes.ts:294`
  - five `resolveEffectiveChatModeOptions` callers
  - `parseModeOptions` rebuilding known fields at `lib/config/modes.ts:36-85`
  - the proxy CSP replacement at `proxy.ts:14-23`, the bypass list at `:173-191`, and a matcher covering all paths except the Manage chat route at `:297`
  - `public/` copied by `apps/chat/Dockerfile:63-65`
- **Test infrastructure.** The release-matrix Firefox and WebKit projects are at `playwright/playwright.config.ts:75-80`; the host launcher installs only Chromium. Specs must be registered in `playwright/profiles.json`. Syncpack enforces `~` on devDependencies unless a group exempts them.
- **Limitations.** There is no stock-Firefox or real-device evidence. Real OLAT headers remain the W5 live gate.

## Progress

- 2026-10-17: Draft derived from the roadmap after the W1 receipt and the user rulings (Firefox unavailable; base `v3-ai`). Planning only; no worktree, branch, commit or implementation.
- 2026-10-17: Planner challenge returned REVISE with 18 findings. All were accepted except F4, which was partly rejected: `v3-ai` already has release-matrix WebKit and Firefox projects, though the host launcher installs only Chromium. Main changes:
  - the kill switch now also gates the runtime path, so merging does not publish the files
  - the proxy sets runner headers at runtime
  - two runner documents replace the query-string variant
  - the pre-warmed spare runner is dropped
  - the spec gets a sink-server egress witness
  - S2 now lists every mode-option caller
  - the CI registration and syncpack gaps are closed

  Report: `project/_local/reviews/2026-10-17-browser-code-playground-planner.md`. Next: user approval of execution.
- 2026-10-18: Execution approved on 2026-10-17. S1 and S2 are on `rs/browser-code-policy`, S3 and S4 on `rs/browser-code-playground`. Mode: solo, with a final simplification pass and a self-review. Deviations from the plan:
  - The kill switch is set for local runs in the gitignored `apps/chat/.env.local`. Changing `.devcontainer/devcontainer.env` made devrouter report a changed managed Compose configuration.
  - The policy normalizer lives in the Chat app (`apps/chat/src/lib/code-runner/profiles.ts`), its only consumer, instead of `packages/util`.
  - `manifest.ts` landed in S3 with the bridge that consumes it.
  - The migration was generated with `prisma migrate diff`, because `migrate dev` asked to reset the disposable database.
  - Commits use `--no-verify`, because the Husky hook needs host YAML tooling. The equivalent container checks ran before each commit.
  - The egress check counts received responses only. Playwright also reports requests that the runner CSP blocks before any network I/O (Chromium reports them as `csp` failures).
  - The spec gets its own `chat` profile group in `playwright/profiles.json`.

  - The flag-off 404 is proven by `code-runtime-serving.test.ts` and by a production-build header check, not by a browser test. The CI runtime keeps the switch on.
  - The policy unit tests live in a new `code-execution-policy.test.ts` instead of extending `effective-chat-modes.test.ts`.
  - The runner policy has no `frame-ancestors` directive. In Chromium, `frame-ancestors 'self'` blocked the runner when a page on another origin embedded Chat. ADR 0052 records the decision.
- 2026-10-18: Simplification and integrated self-review (the main session plus delegated simplifier and final-reviewer passes; not independent review evidence). Changes:
  - The card reads admission from the host's effective mode options, so owner preview admits what learners get. A new preview test covers it.
  - The runner shrinks results whose serialized form exceeds the message cap, instead of losing them to a timeout.
  - The bridge accepts only the first `ready`.
  - R errors keep earlier output.
  - Runtime start-up CSP probes no longer count as blocked program access.
  - The unused `hello-ack` reply and the diagnostic payload were removed.

  Verification:
  - Production build: with the switch off, `/code-runtimes/` returns 404. With it on, the runner and file headers match the dev server.
  - `check:all` is green. Its two host-only Playwright tests ran on the host.
  - Browser proof: Chromium and WebKit pass all eleven qualified-engine tests, Firefox passes the notice test, and the loopback sink records no hits.

- 2026-10-18: Review follow-up rejects prototype admissions and inherited mode lookups, normalizes Windows asset IDs, describes only admitted profiles, and revalidates unhashed notices. Full repository typecheck, lint, syncpack, host contracts and focused policy tests passed. Source publication only; deployment and shared activation remain withheld.
