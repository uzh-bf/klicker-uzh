# Manage assistant integration UX (PR #5637 and follow-up stack)

## Goal

- Problem: The embedded Manage assistant is useful, but the approved UX audit
  records ten trust, workflow, localization, responsive-layout, and
  documentation-retrieval gaps.
- Evidence: See
  [the 2026-08-29 UX audit](./2026-08-29-manage-assistant-integration-ux-audit-and-roadmap.md),
  findings F1-F10 and roadmap phases R0-R3.
- Decision: Resolve F1-F9 and the honest-provenance part of F10 in one
  reviewable assistant-integration stack. Complete deterministic docs search in
  a second sequential stack. Keep R3 lecturer sessions as a separately
  authorized validation milestone.
- Check: Every implementation layer is independently functional, reviewable,
  green, and safe to land. The final exact heads pass the mapped unit,
  integration, browser, accessibility, and CI checks.

## Non-goals

- Durable chat history, thread persistence, retention policy, or new database
  models.
- Autonomous publication, editing, archiving, or destructive element actions.
- Conversation or Manage-context transfer into a standalone browser tab.
- Vector retrieval, embeddings, an external retrieval store, or production
  corpus ingestion.
- Production data, production access, deployment, GitOps, cluster changes,
  merging, or branch/worktree deletion.
- Lecturer recruitment or collection of lecturer-session data under R3 without
  separate approval.

## Plan identity

- Plan: `project/2026-08-29-pr-5637-manage-assistant-integration-ux-plan.md`
- Audit: `project/2026-08-29-manage-assistant-integration-ux-audit-and-roadmap.md`
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Stack A worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/manage-assistant-feedback-fixes`
- Current bottom branch: `rs/manage-assistant-feedback-fixes`
- Current exact head: `902af183d8018c79cadcefe46d4a7f17f395392a`
- Ultimate target: `v3-ai`
- Existing pull request: [#5637](https://github.com/uzh-bf/klicker-uzh/pull/5637)
- Current drift: five commits ahead and ten behind `origin/v3-ai` at the Gate 1
  execution fetch. The exact fetched target approved for the single integration
  pass is `84eebeb483f1a27b10d53f6c598ee3a48ae9f15a`.
- Related history:
  [PR #5624 session UX plan](./2026-08-27-pr-5624-manage-assistant-session-ux-plan.md),
  [PR #5109 readiness plan](./2026-07-23-pr-5109-assistant-production-readiness-plan.md),
  [follow-up roadmap](./2026-07-27-manage-assistant-followup-roadmap.md), and
  [docs retrieval plan](./plans_wip/PLAN-manage-docs-skills-rag.md).
- Control-checkout warning: the primary checkout has unrelated user changes and
  upstream drift. It is excluded from implementation and stays untouched.

## Execution contract

- Authority: One approval of this plan authorizes the named execution
  orchestrator to update the two plan artifacts, initialize and maintain Stack
  A in its existing worktree, create Stack B later in one new repo-local
  worktree, make scoped source/test/wiki edits, generate the checked-in docs
  manifest, run repository-native checks, run required read-only specialist
  passes, create conventional local commits, and update `Progress`.
- Authority: The approval also authorizes changing PR #5637 back to draft,
  updating its title/body for its approved bottom-layer contract, pushing the
  exact Stack A branches to `origin`, and creating/updating the remaining Stack
  A pull requests as drafts through `gh stack`.
- Authority: The approval authorizes one focused local `chat,manage` runtime
  start and verified stop per materially changed runtime snapshot, using only
  seeded or synthetic content. It authorizes the existing Infisical-backed
  startup path to inject the configured model key without printing, reading,
  copying, or persisting its value.
- Authority: After A0 passes on its current base, the approval authorizes one
  upstream integration pass from the exact fetched `origin/v3-ai`: merge it
  once into the bottom branch, reverify A0, then initialize the stack and build
  A1-A4 on that integrated base. This ordering is required because the target
  replaced the old post-start filtering seam with `util/profile-resolver.sh`.
  It does not authorize another integration pass or integrating `v3` or `dev`
  directly.
- Withheld: Opening draft layers for review is Gate 3. Merge, queue, close,
  unstack, reorder, branch/worktree cleanup, deployment, production action, R3
  recruitment, and corrections that change the approved topology remain
  withheld.
- Execution owner: This task is the Stack A topology owner and execution
  orchestrator. One writer operates in the stack worktree. Bounded workers may
  edit only disjoint paths after a fresh privacy and routing check; the main
  task owns seams, integration, product decisions, Git, runtime, and evidence.
- Boundary owner: `self`.
- Terminal: Stack A reaches Gate 3 with every draft layer locally green,
  reviewed, pushed, documented, and accompanied by exact-head CI and browser
  evidence. Stack B then follows as the next approved milestone after Stack A
  lands. R3 remains parked at its external-coordination boundary.
- Pause: Return only for a topology/public-contract change, an unavailable
  required model or runtime after its continuity path is exhausted, a
  security/authorization change beyond advisory capability state, a conflict
  that cannot be resolved confidently, local/remote stack divergence, or a
  withheld authority boundary.

## Follow-up packaging decision

- Evidence: PR #5624 merged recently and PR #5637 already revises the same
  assistant surface. PR #5637 is still open and owns the draft-routing,
  launcher, panel-limit, and clearance changes.
- Decision: Apply the follow-up guard by keeping #5637 as the bottom foundation
  and folding F4 into it because its own clearance commits introduced the
  duplicate spacing. Add genuinely broader capabilities as dependent layers,
  rather than widening #5637 into a cross-system monolith.
- Risk: PR #5637 is currently non-draft. Convert it back to draft before
  publishing expanded-stack work so its state matches the actual review
  contract.
- Decision: Deterministic docs search is a distinct retrieval capability and
  reviewer surface. It becomes sequential Stack B instead of a sixth Stack A
  layer or a large addition to #5637.

## Primitive impact

| Product primitive | Disposition | Contract delta | Consumers and evidence |
| --- | --- | --- | --- |
| Assistant session | Extend | Embedded reset remains ephemeral. Reload and the explicitly labelled standalone action start a fresh conversation without Manage context. | Manage widget, Chat runtime, F1 |
| Assistant availability | Extend | Add authenticated advisory readiness for proposal tools plus loading, degraded, retrying, and failed iframe states. Request-time tool loading remains authoritative and fails to read-only mode. | Manage shell, Chat Manage API, F2/F5 |
| Manage context | Reuse and extend presentation | Keep the bounded sanitized payload unchanged. Present its surface persistently and announce genuine changes; never expose filtered query values. | Parent handshake, Chat header, F7 |
| Signed draft proposal | Reuse | Keep signed server verification and explicit confirmation. After success, the child may send only validated element identity; the parent constructs all navigation. | Proposal card, postMessage, toast, F8 |
| Assistant dock | Extend presentation | Desktop remains non-modal. Compact mode becomes an intentional full-height sheet with close/Escape, focus containment, and background isolation. Desktop gains accessible presets and a larger resize target. | Manage layout and panel helpers, F4/F6/F9 |
| Localization | Extend | All user-visible assistant integration text and actions use the existing EN/DE namespaces. Internal model prompts may stay English when they are not rendered. | Chat and Manage messages, F3 |
| Documentation guidance | Extend | Before search lands, describe the source honestly as a curated KlickerUZH docs index and provide authoritative links or a closest-source fallback. Stack B adds deterministic manifest search, not authority or write scope. | Manage skills and read-only Chat tool, F10 |

## Stress cases and invariants

- A context-ready message arrives after the loading deadline. The delayed state
  keeps the existing iframe alive, so readiness may still recover it; retry
  remounts exactly one iframe and source validation rejects stale messages.
- The parent cannot reliably infer iframe navigation failure from `load` alone.
  Treat the deadline as “taking longer than expected,” reserve hard failure for
  an actual iframe error, and keep close, retry, and the explicitly fresh
  standalone fallback available in both states.
- Advisory capability readiness says healthy, but request-time MCP loading
  fails. The turn stays read-only and the UI updates honestly; preflight never
  authorizes a write.
- Capability preflight returns only `draft-and-read`, `read-only`, or
  `unavailable`, with private no-store caching. It never returns tool names,
  scopes, configuration, or failure detail. While checking, the welcome must
  not present persistence as available.
- Messages have the wrong origin, wrong iframe source, malformed element IDs,
  or attacker-controlled URL text. They are ignored; the parent constructs the
  known Manage route from a validated numeric ID.
- Manage navigation changes during an active conversation. The visible context
  updates and is announced without erasing the thread or silently retaining a
  stale object label.
- Local storage is unavailable or the viewport shrinks. Size defaults and
  clamping keep controls reachable.
- Crossing the 768px breakpoint while the dock is open applies or removes
  compact-only dialog semantics, focus containment, and background isolation
  without remounting the iframe or overwriting the stored desktop size.
- A 320px viewport, virtual keyboard, long proposal, and focus traversal do not
  expose actionable background controls in compact mode.
- Documentation text attempts prompt injection or produces tied/no-result
  matches. Search treats it as untrusted evidence, ranks deterministically, and
  returns an honest empty result.
- Reset clears conversation state but preserves current Manage context and the
  user's panel preference.

## ADR gate

- Decision: No new ADR. The plan extends existing reversible UI, advisory
  readiness, cross-frame presentation, and read-only retrieval contracts. It
  does not change retention, authorization, write authority, or external data
  ownership.
- Re-open when: durable history, autonomous writes, child-controlled
  navigation, external/vector retrieval, new telemetry retention, or a new
  production owner enters scope.

## Skill and research routing

- Process: `rs-sliced-development-workflow`, `rs-product-primitives`,
  `rs-stacked-change`, and the official `gh-stack` mechanics.
- Implementation: `klicker-frontend-ui`, `assistant-ui`,
  `klicker-testing-verification`, `klicker-playwright-e2e`,
  `playwright-best-practices`, `agent-browser`, and
  `klicker-wiki-maintenance`.
- Runtime: `devrouter` and `rs-local-runtime-lifecycle`; use
  `rs-infisical-operator` only for the approved value-free startup path.
- Current-library evidence: Before changing assistant-ui state or transport
  APIs, query current assistant-ui documentation through Context7. Do not
  invent an API from memory.
- Evidence: The worktree currently uses `@assistant-ui/react` 0.15.1 and
  `@assistant-ui/react-ai-sdk` 1.3.41. Current official documentation supports
  deriving message and run state with `useAuiState` and controlling the thread
  through `useAui`. It documents `AssistantChatTransport` as the transport for
  `useChatRuntime`, but does not promise a dynamic per-send `body` callback on
  that AI SDK transport.
- Evidence: The installed `useChatRuntime` implementation wraps the supplied
  transport in a stable proxy and updates its internal transport reference in
  an effect. A new memoized `AssistantChatTransport` therefore supplies the
  latest static request body without recreating the AI SDK chat or its thread.
- Decision: Preserve the existing typed context-body pattern and add a
  regression proving that a context change reaches the next request while the
  active messages remain. Do not introduce a second runtime or transport
  abstraction.
- External research: None is required before implementation. Product and
  repository evidence already settle the intended behavior. Any new library or
  framework API question follows the repository's Context7 rule.

## Planning-stage specialist

- Evidence: No reusable planning report existed in `project/_local/reviews/`.
- Evidence: The configured native planner failed before launch because the
  runtime applied `combo/glm-5.3-flash` with unsupported `max` effort.
- Decision: The routing continuity ladder supplied one read-only generic
  GPT-5.6 Sol planner at xhigh effort. Provenance is `generic-continuity`.
- Accepted: Advisory capability state must not authorize writes; parent-built
  draft navigation; compact mode may be modal while desktop stays non-modal;
  use Default/Wide/Max rather than claiming iframe content-fit; keep docs search
  Chat-local so MCP degradation does not remove help.
- Evidence: The latest `origin/v3-ai` introduces a pure profile resolver. Its
  `chat,manage` selection starts Chat and Manage but still omits
  `@klicker-uzh/mcp-lecturer` and its existing `/healthz` contract. The `mcp`
  capability refers to a separate local read-only fixture. A1 therefore extends
  `util/profile-resolver.sh` and `util/dev-runtime.sh` only for the combined
  focused selection; it does not overload `mcp` or change full-profile and
  production behavior. No `.devrouter.yml` change is currently required.
- Rejected: One widened PR for F1-F10. The proposed surface exceeds the
  roughly 400-line/25-file diagnostic, has several independent reviewer
  audiences, and can be decomposed into complete, safe capabilities. The two
  approved stacks preserve reviewer attention without creating partial user
  states.

## Delivery topology

## Delegation map

| Workstream | Slices | Owner | Dependency and handoff | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Bottom-layer correction | S0-S1 / A0 | `main` | Existing PR and plan state; hands one green current-base branch to the approved target integration | Formatted plan/audit commit, focused prompt/size tests, and browser geometry evidence for question-pool and activity list ends |
| Recoverable shell and runtime | S2 / A1 | `main` | Starts only after the one target integration; critical coupling between parent iframe lifecycle and focused runtime profile | Reducer/runtime tests plus failed, delayed, retry, fresh-tab, health, and stop evidence |
| Capability and workflow trust | S3-S4 / A2-A3 | `main` | Sequential authenticated API, Chat, postMessage, and Manage navigation seams; retained in the orchestrator for security and critical-path coupling | Auth/capability disagreement tests and complete EN/DE draft-revise-confirm-open browser journeys |
| Responsive control | S5 / A4 | `main` | Builds on the stable localized workflow; one-writer stack and cross-frame accessibility coupling make delegation costlier than the bounded implementation | Pure sizing tests, accessibility checks, and three-viewport browser proof including breakpoint transition |
| Stack A finish | S6 | `main` | Consumes all A-layer evidence and required specialist reports | Exact-head local/CI evidence, final review, updated drafts, and complete Gate 3 package |
| Deterministic docs retrieval | S7-S8 / B0-B1 | `main` | Sequential Stack B after Stack A lands; B0 manifest is the fixed input for B1 search | Determinism/drift checks, bounded search safety suite, grounded browser answers, final review, and Stack B Gate 3 package |

Execution-tier skip reason: the approved topology has one writer in one stack
worktree. A0-A4 cross the same parent/iframe/runtime seams, while B0-B1 share a
generated contract; dispatching writable workers would add ownership and
integration cost beyond each bounded slice. Read-only planner, simplifier,
slice-reviewer, and final-reviewer roles remain independently routed.

### Stack A — trustworthy assistant workflow

```yaml
feature: manage-assistant-trustworthy-workflow
provider: github
base: v3-ai
mode: progressive

layers:
  - id: A0
    name: manage-assistant-feedback-fixes
    branch: rs/manage-assistant-feedback-fixes
    pull_request: 5637
    work_package: A complete signed-proposal routing and bottom-right launcher baseline, including collision-safe question-pool clearance.
    responsibility: Preserve direct signed-proposal routing where available, the labelled launcher, and useful panel limits. Fix F4 by restoring Layout's normal padding and replacing full-width desktop bottom clearance with local collision treatment on the question-pool and activity pagination controls; compact layouts may retain only the bottom clearance their fixed launcher actually needs.
    depends_on: v3-ai
    reviewer: Manage frontend and Chat prompt-routing maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Draft intents use the signed proposal path only when supported and available.
      - Closed-launcher clearance prevents collisions without adding vertical whitespace to every Manage page or the full width of desktop list endings.
    validation:
      - Existing Chat runtime tests and panel-size tests
      - Focused launcher-placement plus question-pool and activity list-end Playwright cases
      - Exact A0 CI before any upper layer is treated as green
    activation: complete
    risk: medium
    size_signal: about 70-120 human-authored lines across 8-10 files; no generated output; the open regression-fix package is floor-exempt and remains one coherent baseline.

  - id: A1
    name: manage-assistant-shell-recovery
    branch: rs/manage-assistant-shell-recovery
    work_package: A recoverable assistant shell with honest fresh-tab semantics and a focused runtime that can prove proposal creation.
    responsibility: Resolve F1 and F5, and add R0.4 by starting lecturer MCP for the combined focused chat,manage selection through the target branch's profile resolver and checking its existing /healthz endpoint.
    depends_on: A0
    reviewer: Manage UI, accessibility, and local-runtime maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Timeout, late-ready, retry, close, and fallback states cannot strand focus or duplicate frames.
      - New-tab copy unmistakably describes a fresh conversation without Manage context.
      - The combined chat,manage selection gains lecturer MCP without overloading the separate mcp fixture capability or changing full-profile and production behavior.
    validation:
      - Shell state/helper tests, message-handshake regressions, profile-resolver/dev-runtime tests, and shell syntax checks
      - Failed-route, late-ready, retry, fresh-tab, close, and Escape browser cases at desktop and compact widths
      - Focused runtime start, lecturer MCP /healthz proof, and verified stop
    activation: complete
    risk: medium
    size_signal: about 270-380 human-authored lines across 10-14 files; no generated output.

  - id: A2
    name: manage-assistant-capability-state
    branch: rs/manage-assistant-capability-state
    work_package: Authenticated advisory capability state that keeps useful read-only help available and never grants authority.
    responsibility: Resolve F2 and the immediate provenance portion of F10 with healthy, read-only, degraded, retry states and honest curated-index wording.
    depends_on: A1
    reviewer: Chat API, MCP integration, security, and product-copy maintainers
    attention: judgment-heavy
    reviewer_focus:
      - The endpoint reuses existing Manage authentication and returns only bounded booleans/state.
      - Request-time tool loading remains authoritative and overrides optimistic preflight.
      - Documentation/help and feedback remain usable when proposal tools are unavailable.
    validation:
      - Capability response/auth tests and availability reducer/component tests
      - Healthy, read-only, unavailable, recovery, and preflight/request disagreement cases
      - Browser proof with lecturer MCP healthy and unavailable without a page reload
    activation: complete
    risk: medium
    size_signal: about 250-350 human-authored lines across 8-12 files; no generated output.

  - id: A3
    name: manage-assistant-workflow-continuity
    branch: rs/manage-assistant-workflow-continuity
    work_package: A complete localized draft workflow that keeps current Manage context visible and opens the exact confirmed draft safely.
    responsibility: Resolve F3, F7, and F8 across EN/DE, persistent context presentation, accessible context changes, signed success state, and parent-owned navigation.
    depends_on: A2
    reviewer: Localization, accessibility, Manage integration, and proposal-flow maintainers
    attention: judgment-heavy
    reviewer_focus:
      - No visible assistant integration copy changes language mid-journey.
      - Context remains visible after the first message and announces only genuine changes.
      - Only a validated confirmed element identity can trigger a parent-built editor route.
    validation:
      - EN/DE message coverage, context-label/change, postMessage validation, card, toast, and route-builder tests
      - Draft, revise, dismiss, error, confirm, Open draft, reset, and behind-dock navigation in EN and DE
      - Existing signed-proposal and read-only fallback regressions
    activation: complete
    risk: medium
    size_signal: about 300-400 human-authored lines across 12-18 files; no generated output; this remains one work package because localization, visible context, and success navigation jointly complete the same lecturer journey and each affected component is exercised end to end.

  - id: A4
    name: manage-assistant-responsive-control
    branch: rs/manage-assistant-responsive-control
    work_package: Intentional compact and large-dock compositions with accessible size control.
    responsibility: Resolve F6 and F9 with a compact full-height sheet, compact-only background isolation and focus containment, a 44px resize target, Default/Wide/Max presets, near-viewport desktop sizing, desktop-only persistence, and width-responsive Chat composition.
    depends_on: A3
    reviewer: Responsive UI, accessibility, and design-system maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Compact behavior is intentionally modal while desktop remains non-modal.
      - Presets and manual resizing use one clamping/storage contract, remove the arbitrary 1024px/1200px caps, preserve a reachable viewport edge, and remain keyboard operable.
      - Wider panels improve content composition instead of merely adding blank canvas.
    validation:
      - Panel-size, preset, desktop-only storage, compact/desktop transition, focus, and reduced-motion tests
      - Browser evidence at 1440x900, 390x844, and 320px with long proposals and software-keyboard conditions where automation supports them
      - Accessibility scan and manual keyboard/focus traversal
    activation: complete
    risk: medium
    size_signal: about 220-320 human-authored lines across 6-10 files; no generated output.

follow_up_stacks:
  - Stack B: deterministic documentation search after Stack A lands; two layers separate manifest generation from read-only search integration.
  - R3: three-to-five lecturer task sessions after a stable review build and separate recruitment/data-handling approval.
```

### Stack B — deterministic documentation search

Stack B starts from the updated `v3-ai` only after Stack A lands. It uses a
new repo-local worktree so each feature stack has exactly one worktree.

```yaml
feature: manage-assistant-deterministic-docs-search
provider: github
base: v3-ai-after-stack-a
mode: progressive

layers:
  - id: B0
    name: manage-assistant-docs-manifest
    branch: rs/manage-assistant-docs-manifest
    work_package: A deterministic checked-in KlickerUZH documentation manifest and drift guard.
    responsibility: Generate normalized route, title, headings, summary, tags, and approved media metadata from all current `apps/docs/docs/**/*.mdx` pages plus the twelve use-case records in `apps/docs/src/constants.tsx`, without executing or trusting document instructions. Parse the use-case object with the installed TypeScript AST and extract only declared scalar/list metadata; do not import or render its JSX module. Derive Docusaurus routes from source paths/frontmatter, allow only same-site images and allowlisted HTTPS video URLs, reject duplicate routes, reject missing local media, and omit unsupported schemes such as `upload://`. Store a deterministic schema version, docs version label, and content digest rather than a generation timestamp.
    depends_on: v3-ai-after-stack-a
    reviewer: Documentation platform and build-tooling maintainers
    attention: mechanical
    reviewer_focus:
      - Generation is deterministic, bounded to authoritative docs roots, and fails visibly on malformed or duplicate routes.
      - The manifest covers the complete current v3 public docs source and use-case catalogue, not a hand-picked example list, while legal or student pages remain identifiable by source category for ranking.
      - Generated provenance and human-authored generator changes are reviewable separately.
    validation:
      - Generator unit tests, stable-output repeat, schema validation, and manifest drift check
      - Docs build or focused source check required by the touched docs package
    activation: inert
    risk: low
    size_signal: about 180-280 human-authored lines across 4-8 files plus an estimated 500-1500 generated manifest lines; generated delta is reported separately.

  - id: B1
    name: manage-assistant-docs-search
    branch: rs/manage-assistant-docs-search
    work_package: A Chat-local read-only docs search tool with honest grounded answers and source links.
    responsibility: Complete F10 with a reserved Chat-local `klicker_docs_search` tool, normalized keyword ranking, stable ties, known/ambiguous/no-result responses, authoritative URLs/media, injection fencing, and capability copy that says the assistant searches the current v3 public docs snapshot bundled with its release. Merge the local tool with the request's lecturer-MCP tool set after asserting there is no name collision. Bound query length, result count, per-result context, and total output; return fenced text through the request's existing sentinel so documentation remains evidence and never instructions.
    depends_on: B0
    reviewer: Chat tool-runtime, retrieval, security, and product-help maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Search is read-only, deterministic, bounded, and available when lecturer MCP is degraded.
      - Results distinguish exact, closest, ambiguous, and no-result cases without overstating freshness or coverage.
      - Retrieved text uses the same per-request fence as lecturer-MCP output, cannot grant tool authority, and never exposes repository paths or the sentinel.
    validation:
      - Ranking, normalization, stable-tie, no-result, media, tool-registration, prompt-injection, and budget tests
      - Representative product-help browser questions with source links and honest fallback
      - Exact B0 and B1 CI, final review, and Stack B Gate 3 package
    activation: complete
    risk: medium
    size_signal: about 250-350 human-authored lines across 8-12 files; no additional generated output beyond B0.

follow_up_stacks:
  - Vector retrieval only if measured lecturer queries expose a deterministic-search coverage gap and a new plan/ADR approves its data and lifecycle contracts.
```

## Slice map and commit boundaries

### S0 — Reviewed plan and audit baseline (A0)

- Route: `main`.
- Acceptance: both artifacts pass Prettier and local link targets resolve; the
  commit contains no source changes or unrelated data.
- Do: Add this plan and the approved audit to the implementation branch.
- Check: Markdown formatting and link/path review. No runtime is needed.
- Commit: `docs(project): add manage assistant UX execution plan`

### S1 — Existing PR completion (A0)

- Route: `main` — critical-path coupling to the already-published bottom PR.
- Acceptance: focused prompt/panel tests pass, exact diff inspection accounts
  for every hunk, and browser geometry proves no covered controls or page-wide
  footer strip on question pool and Activities.
- Do: Remove the new global vertical padding, replace the question-pool and
  activity list-end treatment with local launcher collision clearance that uses
  horizontal space on desktop and only necessary bottom space on compact
  layouts, and update #5637 tests, wiki text, and body to cover its whole
  bottom-layer contract.
- Check: Existing Chat runtime, panel-size, launcher-placement, and pool-end
  cases; main-task diff inspection.
- Commit: `fix(manage): remove duplicate assistant launcher clearance`
- Integrate: After A0 is green, merge the one approved exact fetched
  `origin/v3-ai` into A0, resolve only evidenced conflicts, reverify A0, then
  initialize the official stack and create A1. This is the only upstream
  integration pass in Stack A.

### S2 — Recoverable shell and focused MCP runtime (A1)

- Route: `main` — cross-system iframe/runtime seam.
- Acceptance: shell/runtime tests and the failed, delayed, retry, fresh-tab,
  focused-health, and verified-stop cases pass on the integrated base.
- Do: Implement the explicit fresh-tab boundary, bounded iframe state machine,
  retry/fallback, and combined `chat,manage` lecturer-MCP
  profile-resolver/readiness contract.
- Check: Unit/static checks, browser failure/recovery matrix, focused runtime
  start/health/stop.
- Commit: `fix(manage-assistant): make the embedded shell recoverable`

### S3 — Advisory capability state (A2)

- Route: `main` — authenticated capability and authorization-adjacent seam.
- Acceptance: authenticated state, inventory classification, timeout, degraded
  recovery, and preflight/request-disagreement tests and browser cases pass.
- Do: Add the authenticated bounded state, capability-aware welcome, degraded
  notice/retry, and honest curated-index capability copy.
- Check: Authentication/state tests and healthy/degraded browser proof.
- Commit: `enhance(chat): expose assistant capability availability`

### S4 — Localized workflow continuity (A3)

- Route: `main` — postMessage/navigation and complete-journey coupling.
- Acceptance: EN/DE coverage, message validation, context change, proposal,
  toast, route-builder, and complete draft-revise-confirm-open cases pass.
- Do: Move visible EN/DE text into existing namespaces, persist/announce Manage
  context, and add exact confirmed-draft navigation from card and parent state.
- Check: Message, locale, context, proposal-card, route, and complete EN/DE
  browser journeys.
- Commit: `enhance(manage-assistant): complete the localized draft workflow`

### S5 — Responsive assistant control (A4)

- Route: `main` — one-writer UI stack and cross-frame accessibility coupling.
- Acceptance: pure sizing/storage tests, accessibility checks, keyboard
  traversal, and 1440px/390px/320px browser cases pass, including an open-dock
  breakpoint transition that preserves the conversation.
- Do: Replace the compact `85dvh` compromise with a full-viewport sheet. While
  it is open below 768px, apply dialog semantics, contain focus, and make an
  app-content sibling inert and hidden from assistive technology; never mark
  the portal or its own ancestors inert. Remove those effects immediately on
  close or a transition to desktop, where the dock remains non-modal and
  Manage remains interactive.
- Do: Enlarge the resize handle to a 44px target and route pointer, keyboard,
  Default, Wide, and Max changes through the same pure clamp/preset helper.
  Remove the 1024px/1200px hard maxima: the viewport minus the dock's safe edge
  gap is the desktop maximum. Read and write only the desktop size; compact
  layout must neither consume nor overwrite that preference.
- Do: Let the iframe viewport drive a centred readable Chat content cap and
  responsive starter/proposal layouts. Wide and Max must use added horizontal
  space without stretching text or actions across the full dock.
- Check: Helper/component tests, accessibility, keyboard, and three-viewport
  browser evidence, including an open-dock compact/desktop breakpoint crossing
  that preserves the iframe conversation and restores background access.
- Commit: `enhance(manage-assistant): refine responsive dock controls`

### S6 — Stack A integration and evidence

- Route: `main`.
- Acceptance: every layer has exact-head local/CI evidence, required specialist
  reports are dispositioned, drafts describe whole-layer diffs, and the Gate 3
  package is complete without opening or merging them.
- Do: Update wiki pages and dated log, reconcile plan `Progress`, run integrated
  exact-head verification, complete final review, push drafts, and prepare Gate
  3. Do not perform a second target-branch integration here.
- Check: Per-layer local and CI state, browser matrix, review dispositions,
  exact heads, no unrelated diff.
- Commit: Documentation and review corrections stay with the layer whose
  contract they complete; final Progress-only evidence may use
  `docs(project): record manage assistant verification`.

### S7 — Deterministic manifest (B0, after Stack A lands)

- Route: `main` — generated-contract owner for B1.
- Acceptance: schema, duplicate/media validation, double-run equality, drift
  guard, and applicable docs checks pass with human/generated deltas separated.
- Do: Generate and check the authoritative docs manifest.
- Check: Schema, determinism, drift, docs-source, and package checks.
- Commit: `enhance(chat): add deterministic KlickerUZH docs manifest`

### S8 — Docs search integration (B1)

- Route: `main` — retrieval trust and request-tool composition seam.
- Acceptance: bounded ranking/tool/fence tests and representative grounded
  browser questions pass; exact B0/B1 heads clear review and CI for Gate 3.
- Do: Add bounded read-only search and grounded source presentation.
- Check: Search/tool safety suite, browser help queries, wiki/log, integrated
  final review, exact-head CI, and Stack B Gate 3 package.
- Commit: `enhance(chat): add deterministic KlickerUZH docs search`

## Feature-wide test portfolio

| Consequential behavior or risk | Existing evidence | New obligation | Primary stable seam | Distinct failure caught | Owner |
| --- | --- | --- | --- | --- | --- |
| Signed drafts use proposals only when supported | `manage-assistant-runtime.test.ts` and #5637 CI | Preserve and extend only if routing changes | System-prompt builder | Prose/JSON output or unavailable-tool call | A0 |
| Closed launcher does not cover controls or waste page-wide vertical space | Current Playwright launcher assertions | Question-pool and activity list-end collision/whitespace regressions | Pagination controls and launcher geometry | Covered controls or blank footer strip | A0 |
| Iframe load recovers | Loading spinner exists | Reducer/helper plus failed, late-ready, retry cases | Parent shell state machine | Infinite spinner, duplicate frame, stale timeout | A1 |
| New tab is a fresh session | Standalone URL exists | Localized warning/action semantics | Widget action and standalone route | False implication that thread/context transfers | A1 |
| Focused runtime includes lecturer MCP | Full profile starts it; combined focused selection does not | Combined-selection filter plus `/healthz` readiness | Profile resolver and runtime probe contracts | False green proposal verification | A1 |
| Capability state is advisory and authenticated | Request-time load fails toolless | Auth response and disagreement tests | Manage capability API/service | Preflight grants authority or leaks detail | A2 |
| Degraded mode stays useful | Read-only prompt fallback exists | Welcome notice, disabled/relabelled starters, retry | Availability view model | Creation promise when tools are absent | A2 |
| EN/DE interaction stays in one language | Partial namespace coverage | Message-key and complete journey assertions | Existing i18n namespaces | Mixed-language actions/errors/context | A3 |
| Manage context remains visible and current | Sanitized handshake tests | Persistent chip and change announcer | Context store/hook/component | Ambiguous “this question” after navigation | A3 |
| Open draft is exact and parent-owned | Created-element message validation | ID sanitization, route builder, card/parent actions | postMessage contract and parent router | Child URL injection or wrong draft | A3 |
| Reset preserves non-conversation preferences | Reset flow tests | Context/panel preference regression | assistant-ui runtime plus parent state | Reset removes context or sizing | A3 |
| Compact mode prevents accidental background action | Current 85dvh Playwright state | Focus/inert/background and close/Escape cases | Manage shell composition | Active exposed Manage controls | A4 |
| Resize and presets share safe clamps | Panel helper tests | Preset, 44px target, near-viewport maximum, desktop-only storage/privacy tests | Pure panel-size helpers | Unreachable control, arbitrary large-screen cap, or compact size overwriting desktop preference | A4 |
| Wide panels use space coherently | Current max screenshot only | Width-responsive welcome/transcript/proposal case with readable centred caps | Chat CSS variable/layout | Blank canvas, overlong text, or over-wide controls | A4 |
| Docs manifest is reproducible | Static in-prompt index | Double-run equality and drift guard | Manifest generator | Silent stale or nondeterministic index | B0 |
| Docs search is bounded and honest | Prior WIP plan | Known, ambiguous, tied, no-result, media, injection cases | Pure ranking/search service | Overclaim, unstable ordering, injected instruction | B1 |
| Complete signed flow works live | PR #5624 prior evidence | Exact-head EN and DE draft-revise-confirm-open journey | Focused seeded runtime and Playwright | Unit-green but broken cross-app flow | A3/A4 integration |

## Verification matrix

- Per changed package: focused tests first, then `check`, lint, and formatting for
  the touched workspaces. Run broader repository checks when the package or
  pre-push hook requires them.
- Frontend: `agent-browser` before/after evidence at 1440x900 and 390x844, plus
  320px for compact composition. Use delegated local lecturer credentials and
  seeded/synthetic content only.
- Locale: parent routes under `/en/` and `/de/`; verify the iframe locale and
  complete proposal-card action/error/success journeys.
- Availability: healthy MCP, unavailable MCP, read-only scope, retry recovery,
  failed iframe, late readiness, and preflight/request disagreement.
- Workflow: draft, full options/correctness/feedback preview, referential German
  revision, confirmation, refreshed pool, Open draft, return, reset, and context
  change behind the desktop dock.
- Responsive: close/minimize, Escape, keyboard focus, background isolation,
  manual resize, Default/Wide/Max, persistence, viewport shrink, long proposal,
  open-dock compact/desktop transitions, reduced motion, and available
  software-keyboard simulation.
- Documentation: known page, ambiguous query, no result, tied result, media,
  stale-manifest detection, and adversarial text.
- CI: inspect every layer PR separately at its exact head. Report passed,
  skipped, pending, blocked, and repository-wide status-context failures as
  separate claims.

## Wiki, artifacts, and evidence

- Update `docs/chat-platform.md`, `docs/frontend-conventions.md`,
  `docs/getting-started.md`, and `docs/testing.md` where their described
  behavior changes.
- Keep the final user-visible behavior, local/CI evidence, and remaining R3
  boundary in the authoritative wiki pages and this plan's dated `Progress`;
  the repository's reserved `docs/log/` path must remain absent.
- Keep this audit and plan current in the implementing stack. Later Stack B
  branches update this same plan's `Progress` rather than creating a second
  epic plan.
- Keep browser screenshots local and uncommitted. Attach selected before/after
  evidence to draft PR descriptions only when publishing the Gate 3 package.
- Do not hand-edit generated changelogs. Report generated manifest lines
  separately from human-authored deltas.

## Review routing

- S1/A0: Main-task diff inspection and focused verification; existing #5637
  review remains reusable unless behavior changes materially.
- Every substantive slice A1-B1: Commit the immutable scope, then run one
  simplifier. Run one slice reviewer in parallel where the slice crosses
  runtime, authenticated API, postMessage/navigation, accessibility/modal, or
  retrieval trust boundaries. Verify and disposition every finding in its
  owning layer.
- Stack A and Stack B: After integrated exact-head verification, run one trusted
  final reviewer over the complete immutable stack range and all included
  paths. One same-reviewer correction pass is the maximum when material
  corrections re-arm the gate.
- Persist useful reports under `project/_local/reviews/`; `_local/` stays
  uncommitted and is used for reuse preflight.
- Treat reviewer output as advice. The main task verifies all findings and owns
  readiness claims.

## Gate 3 and landing boundaries

- Gate 3 presents every Stack A layer with URL, exact head, human/generated
  delta, reviewer audience, attention class, validation, risk, CI state, and
  bottom-up review order. It asks whether to open, revise, or leave drafts.
- Stack B gets its own Gate 3 after Stack A lands and Stack B is implemented.
- The agent never merges, queues, closes, un-stacks, reorders, or deletes stack
  branches/worktrees. Landing remains a human forge-UI action after a separate
  Gate 4 readiness report.
- Deployment and runtime proof after merge are separate from source, CI, and
  GitHub readiness.

## Progress

- Status: `active_a2_review`
- Baseline: PR #5637 exact head `85ffe927774b44b7a1b0759fa4fdbfeae81c5a96`
  and PR #5670 exact head `c0d71a444dce3b9b4c83ee94db9e0fd5a27f3e53`
  are open, non-draft, and mergeable after the user-managed stack rebase. All
  applicable exact-head checks and all eight Playwright shards pass for both
  layers. The final-review aggregate remains red only because stack root #5637
  targets `v3-ai` instead of the repository default branch.
- Planning: Approved F1-F10 audit mapped into Stack A, Stack B, and R3. Native
  planner launch failed; generic-continuity GPT-5.6 Sol returned
  `DONE_WITH_CONCERNS`. Accepted contract corrections are recorded above; its
  single-PR topology was rejected on reviewability evidence.
- Authority: User approved Gate 1 on 2026-08-29. The plan now authorizes S0-S6,
  the single exact target integration, draft stack publication, and focused
  runtime verification through Stack A Gate 3; withheld actions remain
  unchanged.
- S0: Commit `2d38a700b` added the reviewed plan and audit with no source
  changes. PR #5637 is draft again.
- S1: Layout uses normal page padding. Question-pool and Activities pagination
  reserve horizontal launcher space on desktop and only compact bottom
  clearance. Frontend and Playwright typechecks, focused formatting, and test
  discovery pass under the pinned Volta toolchain. The repository wiki
  validator reports 35 pre-existing core errors and none in the changed page or
  new receipt. Commit `cb188b3a2` contains the complete slice. The independent
  simplifier found no clear behavior-preserving net reduction.
- Runtime evidence: Exact-worktree startup first exposed the fixed Azurite
  port collision, then cleared it with free task port `11003`. Startup still
  failed before the app ran because installed devrouter `0.0.45` and the
  repository pin `0.0.36` led DevPod `0.6.15` to report
  `inject agent: agent binary not found`. The temporary uncommitted `waitFor`
  compatibility patch was restored. The exact DevPod is absent and devrouter
  reports zero exact routes. Local browser proof is therefore blocked by host
  tooling; the focused browser regression remains required in exact-head CI.
  After target integration upgraded the repository pin to `0.0.42`, the host
  Playwright launcher reached the managed-runtime preflight but stopped before
  mutation because `.devcontainer/devcontainer.json` still declares
  `postCreateCommand` without `waitFor`. The exact non-destructive stop
  completed. This configuration seam is necessary for A1's focused runtime
  proof and will be handled there rather than widening A0.
- Research: Context7 confirmed the 0.15 state API, and installed package source
  confirmed the stable dynamic-transport proxy. The plan now reuses that seam;
  its message-continuity behavior remains a regression-test obligation.
- Drift disposition: The latest target changes the local-runtime profile seam
  and overlaps A1. The single integration pass now occurs immediately after A0
  passes, before upper layers exist, so A1 extends the current resolver and
  readiness architecture directly. The remote-tracking ref advanced from the
  approved `84eebeb483f1` to `bedc6a8556b0` before the local merge. The added
  commit changes only staging deployment image references. The user explicitly
  approved retaining that newer target in the single integration pass; merge
  commit `59661f091` records it. The unrelated primary checkout stays untouched.
- A0 integration verification: `@klicker-uzh/frontend-manage` and Playwright
  typechecks pass on the merged tree, as does focused Prettier validation. The
  local browser gate remains blocked at the fail-closed `waitFor` preflight, so
  exact-head CI must execute the focused regression before A1 starts.
- A0 preflight: `twMerge` resolves Layout's new `pb-24` plus the question-pool
  `pb-2` override to `pb-2`, so the audit's two named vertical utilities do not
  literally stack on that page. The visual finding still stands, but its safe
  correction is to remove the global padding and use local list-end geometry,
  not to retain the global padding as the earlier draft proposed. The same
  focused treatment covers Activities, which shares the list-end pagination
  seam and currently has no launcher clearance.
- A1 preflight: The widget already validates origin and current iframe source,
  keeps the iframe mounted across close/open, and uses the context-ready message
  as its authoritative ready signal. A1 will preserve those contracts, add a
  pure loading-state reducer with one retry generation, and use a delayed state
  rather than claiming failure from a missing handshake. Retry remounts the same
  embedded URL; a late valid ready message wins. The standalone action and
  fallback are always labelled as a new conversation without Manage context.
- A2 preflight: `GET /api/manage/capabilities` can reuse
  `getAuthenticatedManageUser`, `isManageAiEnabled`, and the existing scoped
  lecturer-MCP loader. Classify the actual session-filtered tool inventory,
  close the temporary client, and return only `draft-and-read`, `read-only`, or
  `unavailable` with `private, no-store`; use a bounded abort signal and a
  generic server-side warning on failure. The current chat route derives draft
  wording from session scope, which is weaker than the actual inventory. A2
  replaces that check with the same pure inventory classifier on every turn;
  the signed proposal tool must actually be present before draft persistence is
  described as available. The client starts conservatively, keeps docs and
  explicit no-save authoring useful, relabels persistence starters when needed,
  and retries capability preflight without reloading the iframe.
- A3 preflight: Keep the sanitized context payload unchanged. Resolve visible
  surface/object labels through `next-intl` in the client while leaving internal
  prompt metadata in English; render the chip in persistent embedded chrome and
  announce only JSON-distinct context changes after the initial context. Move
  every starter label/prompt and proposal status, action, raw-details label, and
  safe error category into the EN/DE namespaces. Do not render server error text
  directly. Parse the confirmed element before success. Add a separate
  child-to-parent open request carrying only a positive integer element ID;
  validate origin, current iframe source, type, and payload, then let Manage
  build `{ pathname: '/', query: { editElementId: String(id) } }`. Both the card
  and toast call that parent-owned handler. It closes the dock without restoring
  launcher focus before routing so the editor modal owns focus; standalone Chat
  renders no Manage-open action. No URL, name, locale, or route supplied by the
  child controls navigation.
- A4 preflight: The current hard maxima are 1024px wide and 1200px high, the
  compact panel is an active-background `85dvh` sheet, and the resize target is
  28px. A4 removes the hard maxima in favor of the safe viewport edge,
  preserves desktop-only storage, and isolates only an app-content sibling in
  compact mode so the portalled dock never makes itself inert.
- B0/B1 preflight: The authoritative source currently comprises 49 MDX pages
  and twelve use cases. B0 reads MDX plus scalar/list use-case metadata through
  the TypeScript AST without executing JSX. B1 composes a reserved local search
  tool with MCP tools and fences its bounded text through the existing request
  sentinel.
- A0 exact-head CI correction: Hosted build and shards 1, 2, 4, 5, and 6
  passed. Shards 3, 7, and 8 independently showed the closed launcher's wide
  text pill intercepting unrelated bottom-right controls in group grading,
  template creation, and invitation pagination. The branch now keeps the
  launcher in the same corner as a 48 px icon-only target and pins that compact
  geometry in the focused assistant regression before rerunning exact-head CI.
- A0 completion: Corrected head `4e41ec1054cc` passed the hosted build and all
  eight Playwright shards in run `33258434945`. OpenCodeReview reported zero
  findings, the only CodeRabbit thread remains resolved and outdated, and all
  applicable exact-head checks passed. The Final AI review workflow completed
  successfully; its draft-only review jobs stayed skipped and its aggregate
  status remains pending while the PR is draft.
- Stack A: The approved stack now records `v3-ai` →
  `rs/manage-assistant-feedback-fixes` →
  `rs/manage-assistant-shell-recovery` without a second upstream integration.
- A1 runtime preflight: Current devrouter rejected the target configuration
  before mutation because native `runServices` included Azurite without a
  managed-runtime classification. The app container declares Azurite as a
  healthy startup dependency, so A1 adds it to the managed base-service
  registry alongside Postgres and Hatchet.
- A1 local runtime evidence: The first focused start exposed the documented
  fixed Azurite graph-worker port colliding with another workspace. Retrying
  with the supported free `KB_GRAPH_BLOB_HOST_PORT=10013` override cleared that
  collision, but both starts terminated in Devsy's agent-injection phase with
  `inject agent: [inject] open binary: agent binary not found`. The exact
  worktree runtime was stopped through devrouter and now reports no active or
  present managed services, processes, or routes. Local browser and lecturer
  MCP health proof therefore remain blocked by host runtime tooling; A1's
  focused hosted Playwright regression and exact-head CI remain required before
  the layer can be accepted.
- A1 static runtime verification: `devrouter repo devcontainer verify --json`
  reports five checks OK, no warnings, and no errors for the changed
  devcontainer/devrouter configuration.
- A1 review: Both configured specialist routes failed before launch because
  the runtime applied unsupported `max` effort to `combo/glm-5.3-flash`.
  Generic-continuity reviewers therefore covered both required gates: Luna at
  medium effort for simplification and Sol at xhigh effort for the runtime,
  iframe, and accessibility risk review. The simplifier's actionable test
  finding is accepted by wiring all existing Manage assistant pure tests into
  the package `test:run`. Its proposed removal of URL identity is accepted only
  for redundant transition payloads: reducer state retains the current URL so
  a ready phase cannot leak across locale/navigation changes. The risk review
  correctly found that FastMCP 4.13.1 serves `/healthz` as `200 text/plain`,
  while the first probe and fixture required JSON; the corrected dedicated
  text-health contract now matches installed package documentation.
- Next: A1's recoverable iframe shell, honest standalone boundary, focused
  lecturer-MCP runtime contract, and independent reviews are complete at head
  `97fea1a227c6`; all local checks pass. Stacked draft PR #5670 is published
  on top of #5637. Exact-head hosted CI, including the focused Playwright
  regression, remains required before the layer can be accepted.
- A1 exact-head correction: OpenCodeReview's fourth round correctly identified
  that a same-generation iframe error could regress an already delayed or ready
  frame. Commit `64765b51c3ff` now limits failures to loading and retrying states,
  adds delayed and ready regression cases, and makes the reducer's action union
  exhaustive. The hosted shard-2 trace also confirmed that the document abort
  occurred while the hand-written non-bubbling event failed to reach React;
  the focused browser test now uses Playwright's composed, cancelable, bubbling
  `dispatchEvent` seam. The unrelated shard-4 analytics navigation failure did
  not touch this branch's files and remains classified as CI infrastructure
  noise pending the exact-head rerun.
- A1 correction verification: All five Frontend Manage pure test files pass,
  the Frontend Manage and Playwright TypeScript checks pass, focused Biome and
  Prettier checks pass, and the commit hook completed the repository-wide
  check, format, lint, Syncpack, secret, wiki, Prisma-sync, and Playwright-host
  checks. Local browser execution remains blocked by the unchanged Devsy agent
  injection failure recorded above.
- Next: Run the required post-correction simplification and risk reviews, then
  push PR #5670 and require a clean exact-head hosted browser run before A1 is
  accepted.
- A1 correction reviews: The `slice-reviewer` found no actionable defect in
  `5a2230218..359341e51` and retained exact-head hosted browser execution as the
  only evidence gap. The `simplifier` proposed restoring the permissive final
  reducer fallback to save two lines. That suggestion is rejected because it
  would reintroduce OpenCodeReview's verified silent-action-swallowing defect;
  the exhaustive `never` check is the intended compile-time state-machine
  invariant. Reports are retained under `project/_local/reviews/`.
- Next: Push PR #5670, reply to and resolve the verified OpenCodeReview thread,
  refresh the whole-branch PR body, and require clean exact-head hosted CI
  before A1 is accepted.
- A1 native iframe-error correction: Exact-head run `33278326505` passed the
  hosted build and seven Playwright shards, but shard 2 reproduced the failed
  recovery journey on both attempts. Its trace proved that Playwright
  dispatched `error` on the current iframe while React left the loading state
  unchanged. Installed React 19 source wires a non-delegated `load` listener
  for iframes, but not `error`; commit `f8b86fd59` therefore replaces the JSX
  handler with a callback-ref-owned native listener while keeping the timeout
  as Chromium's authoritative recovery path.
- A1 native-listener verification: All five Frontend Manage pure test files,
  the affected Frontend Manage and Playwright TypeScript checks, focused Biome
  and ESLint, the complete commit hook, and the 26-task pre-push build pass.
  The post-commit slice review found no actionable issue in listener cleanup,
  retry-generation identity, stale-event protection, or accessibility. Exact-
  head hosted shard 2 remains the final browser proof.
- Next: Refresh PR #5670 for head `f8b86fd59`, then require a clean exact-head
  hosted browser run before A1 is accepted.
- A1 rebased reconciliation: The user rebased the stack remotely without
  changing its reviewed behavior. A0 now ends at `85ffe927774b`, and A1 ends at
  `5115e2958f3d`. PR #5670 covers 14 commits, 23 files, 658 additions, and 47
  deletions; its whole-branch body reflects the rebased range.
- A1 exact-head acceptance: Hosted build, codebase check, unit tests, gitleaks,
  SonarCloud, CodeQL, trusted policy, and all eight Playwright shards pass at
  `5115e2958f3d`. All four OpenCodeReview threads are resolved, no later review
  feedback remains, and both stack layers are mergeable.
- A1 stack-policy residual: `final-ai-review` and `final-ai-stack-review` stop
  before review because the native stack root targets `v3-ai` rather than the
  repository default branch. This is a workflow topology limitation, not an
  A1 source failure. Changing PR bases remains outside the approved plan.
- Local continuation: The pre-rebase local branch is preserved unchanged. The
  existing stack worktree now uses local branch
  `rs/manage-assistant-shell-recovery-resume`, based exactly on
  `origin/rs/manage-assistant-shell-recovery`, so A2 can continue without a
  reset, rebase, force-push, second worktree, or history rewrite.
- Next: Commit and publish this A1 receipt to PR #5670, then create A2
  `rs/manage-assistant-capability-state` from the accepted A1 head and begin
  the authenticated advisory capability-state slice.
- A1 receipt: Commit `c0d71a444` records the rebased acceptance evidence on
  PR #5670. A2 branch `rs/manage-assistant-capability-state` starts from that
  exact head without another upstream integration.
- A2 implementation: The authenticated private no-store preflight now derives
  one of three public states from the actual session-filtered lecturer-MCP tool
  inventory and closes its bounded temporary client. Chat turns repeat the same
  classification and return it in a response header. The conservative client
  keeps no-save drafting and curated documentation help useful, relabels
  persistence starters, supports in-place retry, and prevents a late preflight
  from overriding newer request-time evidence.
- A2 verification: Forty focused Chat tests, Chat and Playwright TypeScript
  checks, focused Biome and Prettier checks, and the unchanged full Chat suite
  pass under the pinned Node 24 toolchain. The wiki validator still reports its
  35 pre-existing core errors and reports none in `docs/chat-platform.md`.
- A2 runtime boundary: A focused local `chat,manage` start reached ready once,
  but the installed devrouter then ignored the requested profile, fell back to
  the full stack, terminated Turbo, and left unusable routes. The exact runtime
  is stopped and reports zero routes. Hosted exact-head Playwright remains the
  browser acceptance boundary; repeated local startup is not useful evidence.
- Next: Commit the A2 slice, run the required simplification and risk reviews,
  disposition any verified findings, then publish it as the next draft stack
  layer and require exact-head hosted browser evidence.
- A2 reviews: The authenticated API/MCP risk review found no actionable defect
  or material evidence gap. The simplifier's redundant `draftIntent` finding is
  accepted because the no-save override map already owns the same key set. Its
  reducer-removal finding is rejected: the approved validation contract calls
  for the pure reducer, and the proposed replacement changes retry from the
  conservative unavailable state to the prior optimistic capability.
- A2 build evidence: The repository build completed the generated GraphQL
  output but its Rollup process then slept for eight minutes without children,
  reproducing the existing host-only build stall. The process was interrupted.
  Focused Chat build evidence and hosted exact-head build/browser checks remain
  required after the simplification correction.
- Next: Verify and commit the accepted simplification, publish A2 as a draft
  stack layer, and require exact-head hosted build and browser evidence.
- A2 publication and review: Draft PR #5679 publishes head `897263afdd8b` on
  top of PR #5670. Its hosted compile, repository checks, package filters,
  fallback build, and first OpenCodeReview pass completed successfully.
  OpenCodeReview found three medium and two low issues. The valid corrections
  distinguish transient preflight failures with HTTP 503, add a bounded
  browser-side request signal plus non-OK handling, qualify every read-only
  starter as no-save, and share the unavailable plan/feedback copy. The
  review's claim that unavailable state has no retry was rejected because the
  settled notice already renders an in-place retry and the browser regression
  pins iframe preservation.
- A2 review-correction verification: The complete Chat suite passes with 752
  tests and 13 intentional skips; Chat and Playwright TypeScript checks and
  focused Biome/Prettier checks pass. The corrected browser journey now covers
  a stalled preflight timing out, retrying, and recovering without remounting
  the iframe. Hosted exact-head build, browser, and follow-up review evidence
  remain required after the correction is committed and pushed.
- Next: Commit and push the A2 review correction, reply to and resolve all five
  review findings with evidence, refresh PR #5679, and babysit the corrected
  exact head through hosted browser acceptance before starting A3.
- A2 exact-head review: Head `7ccd44ada` passes the hosted compile, repository
  check, secret scan, GraphQL and lecturer-MCP status checks, trusted policy,
  and OpenCodeReview. The follow-up review raised one valid nested-ternary style
  finding and one question about timeout semantics. The notice now uses explicit
  branches, and the platform documentation states the intentional contract: a
  bounded client preflight settles as retryable unavailable rather than
  starting an automatic background retry loop. The existing browser journey
  pins timeout, manual retry, healthy recovery, and iframe preservation.
- Next: Commit and push this review-only correction, resolve both follow-up
  threads, then require all eight exact-head hosted Playwright shards before A2
  is accepted and A3 starts.
- A2 exact-head review round three: OpenCodeReview's three low-severity summary
  findings were accepted. The capability notice now keeps its retry control
  outside the live status region; the welcome stays neutral while advisory
  readiness is checking, so it neither promises persistence nor flashes
  degraded limits; and read-only override keys are derived from the actual
  starter arrays so stale keys fail type checking. The focused 22 capability
  and suggestion tests, Chat and Playwright type checks, Biome, Prettier, and
  diff checks pass. The revised hosted journey pins the neutral checking state.
- Next: Commit and push the final A2 review correction, post the summary
  disposition, refresh PR #5679, and require all eight exact-head hosted
  Playwright shards before accepting A2 and starting A3.
- A2 review round four: The accepted low-severity findings replace reverse
  array mutation with explicit capability-state layouts, align the preflight
  request with the file's async/await style, centralize the no-save boundary,
  and document why write-oriented starters use full copy overrides while other
  prompts use a conservative suffix. The shared API-path suggestion is rejected
  because the filesystem route is authoritative and a client constant would be
  a second source of truth. Raw preflight error logging is rejected because this
  public endpoint intentionally emits values-free diagnostics.
- A2 capability-settle correction: OpenCodeReview correctly found that a
  failed or headerless latest chat response could strand the client in the
  checking phase with no visible recovery control. Commit `bb591019d` fixes
  both sources: the route no longer lets best-effort MCP teardown extend the
  bounded response, and every latest-started chat result (headerless or
  rejected) settles retryable `unavailable` instead of leaving checking
  active. Reducer checks return fresh state, impossible actions serialize
  context, and the new preflight guards carry inline rationale.
- A2 correction review evidence: The simplifier covered
  `e6bc54856..bb591019d` natively with no net simplification. The native
  slice-reviewer, the generic-continuity substitute, and the user-authorized
  cross-provider fallback all failed before inspection on the same OpenRouter
  budget cap (65,536 requested vs 50,454 affordable tokens). The documented
  main-session substitute completed the required risk review on the full
  one-commit diff plus call sites with fresh Node 24 exact-head evidence and
  found no defect across abort/teardown, conservative settle, values-free
  diagnostics, and reducer contracts; the fallback identity is recorded in
  `project/_local/reviews/2026-08-30-a2-capability-correction-slice-review-fallback.md`.
- A2 correction verification: The two affected Chat test files pass 17/17
  fresh on Node 24 at the exact head; complete commit hooks and the 26-task
  pre-push repository build pass; summary disposition is posted top-level and
  the three OCR threads are replied to and resolved.
- Next: Refresh PR #5679 for head `bb591019d`, wait for fresh exact-head
  hosted CI including all eight Playwright shards, accept A2 when it settles
  green with clear feedback, then start A3.
- A2 review round five: Two inline and seven summary findings were verified.
  Accepted corrections keep cancellation from downgrading a settled
  capability, compose the browser preflight signal without
  `AbortSignal.any`, make the neutral checking branch explicit, flatten the
  runtime prompt selection, derive override ids as literal unions, normalize
  no-save instructions, and localize EN/DE starter labels. Raw exception
  logging remains rejected because the capability endpoint intentionally emits
  values-free diagnostics. One content observation required no code change.
  The hosted Playwright contract now pins German degraded-state labels.
- A2 round-five verification: 56 focused Chat tests, Chat and Playwright
  typechecks, Biome, Prettier, and diff checks pass. Local browser startup was
  blocked before readiness because the managed DevPod could not resolve its
  namespaced Azurite alias; the exact runtime was stopped with zero routes, so
  browser acceptance remains an exact-head hosted Playwright gate. The prior
  shard-three failure was an unrelated live-quiz deletion timeout and will be
  re-executed on the corrected head.
- A2 locale correction: Exact-head Playwright shard one found the German
  degraded suggestions rendered in English. Manage already passed `locale=de`
  in the iframe URL, but Chat only read `NEXT_LOCALE` from cookies. Commit
  `b1c6d4a19` validates the shared locale set, forwards the valid locale to the
  `/manage` request, and sets a path-scoped response cookie. The focused
  locale tests cover valid German and English values plus invalid and missing
  values. Chat typecheck, Biome, commit hooks, and the 26-task pre-push build
  pass; the prior full Chat run also passed the new locale suite but hit its
  known local loopback restriction in the unrelated MCP canary.
- A2 proposal-layout correction: Exact-head hosted shard one showed the
  proposal content and controls rendered correctly, but the strict geometry
  assertion compared a clipped scroll-container layout box directly with the
  separate composer. Commit `2b7ae887a` now settles the thread viewport and
  checks the proposal against the viewport fold and composer boundary, matching
  the existing chat layout contract.
- A2 capability-meta correction: OpenCodeReview found that the registered
  `klicker_lecturer_capabilities` `manage:read` tool was omitted from the
  selected read-capable tool sets. Commit `82e92c1c2` preserves it in
  `read-only` and `draft-and-read` while keeping a meta-only inventory
  `unavailable`. The 30-per-lecturer/5-minute preflight burst guard was
  verified as intentional and already documented as best-effort and per-pod;
  that low-severity observation required no code change.
- A2 latest verification: The focused capability tests pass 11/11; Chat and
  Playwright typechecks, Biome, the complete commit hook, and the 26-task
  pre-push build pass at `82e92c1c2`. Both new OCR findings have replies with
  evidence. Local browser execution remains unavailable because the managed
  DevPod exposes zero routes; hosted Playwright remains the acceptance gate.
- Next: Refresh PR #5679 for `82e92c1c2`, wait for fresh exact-head hosted CI
  including all eight Playwright shards, accept A2 when it settles green with
  clear feedback, then start A3.
