# Flash reviewers with focused GLM advisors

## Approval summary

Use GLM-5.3 Flash at maximum reasoning for every main OCR review, including individual final review, stack code review, topology and preflight. Full GLM-5.3 at maximum reasoning becomes a focused advisor that receives only a question and the selected source excerpts. The user explicitly authorized this policy: Flash reviews the change and generously consults the advisor for difficult or architectural parts. This is an executable batch ending with reviewed source, ordinary commits/pushes and one draft PR against `v3`; readiness, merge, private activation, credentials/settings and extra provider replays remain separate.

The advisor allowance increases from two to eight attempted consultations per review job, shared by concurrent workers, code ranges, the existing permitted resume and topology. Failed, invalid, cancelled and interrupted consultations consume attempts. Each consultation retains the three-range, 120-line/8-KiB per-range, 16-KiB request, 16,384-output-token and 480-second limits. Advice is evidence assessed by Flash and is never a substitute approval. The higher ceiling permits more focused consultations; live cost and review quality remain unqualified. Main reasoning, token budgets, retry/resume rules, selection, concurrency, task timeouts, coverage and publication gates remain unchanged.

The portable skill will proactively direct architecture, ownership/lifecycle, cross-system contracts and consequential unresolved questions to the advisor after initial source inspection. It will request a focused assessment with competing explanations and decisive ranges. It will not forward the complete PR, diff, conversation, background or full repository guidance. Missing relevant source and unavailable advice remain explicit gaps.

## Execution details

Execution mode: standard, full path for model policy, bounded tool execution, accounting and final-review evidence. Reuse the clean existing task worktree on `rs/ocr-flash-advisor`, target `v3` at `a3286cc5cc77b98c7255b596084fd1032682bdaf`. The preceding one-PR delivery change is merged as [PR #6739](https://github.com/uzh-bf/klicker-uzh/pull/6739).

### Shared advisor lifecycle

Extend existing modules only. `ocr-review-tools.cjs` owns the eight-attempt constant and injected allowance. Drafts use one in-memory allowance. Final workflows initialize one private, parent-owned allowance under `RUNNER_TEMP` before any review attempt, using exclusive creation and frozen job head/policy identity. Sequential range/resume/topology processes load the same validated allowance. Admission persists a reservation before source validation or provider dispatch. Missing, corrupt, changed-identity or unwritable continuation state fails closed rather than granting a new allowance. A new workflow job attempt has a separate scratch lifecycle; an OCR resume never initializes state.

A helper in that existing module starts the full-model advisor adapter and authenticated source broker, records expected adapter lifetimes before dispatch, composes trusted final rules with the portable skill, and returns MCP configuration and a bounded tool-call interface. Main and advisor receipts remain separate. It closes broker then advisor and exposes only loopback capabilities to OCR. Finals initially expose advisor/context reads, without introducing Context7 credentials. Source ranges are read from the frozen source commit for the current code range; topology uses the frozen cumulative stack head. Earlier-layer or deleted source cannot be silently substituted: unavailable ranges fail explicitly, and Flash retains the limitation. No arbitrary revision selector or new source-read capability is introduced.

### Flash execution and topology

Explicit Flash identities replace full-model aliases in final/stack policy, preflight, validators, status text and reports. Full-model advisor identity remains distinct. `callMistral` becomes provider-aware while retaining its existing default and translation, diagnostics and one-request/no-retry contract. `commandRun` attaches the final source broker through the ephemeral OCR configuration and adds only its local bearer capability to the sanitized child environment. Stack range invocations pass their actual reviewed head; the allowance retains the stable job head/policy identity.

Topology uses Flash with at most nine model turns: up to eight focused advisor interactions followed by a final answer. Its existing 600-second deadline applies to the complete conversation, including consultations. Its existing 65,536 completion-token allowance is aggregate across Flash turns, and the existing one-million-byte serialized request ceiling applies on every turn. Each continuation must contain exactly one permitted advisor tool call with valid arguments and matching result identity. Reasoning history is preserved through the existing adapter history representation. Exhausted or unknown token usage, deadline exhaustion, invalid tool calls, truncated or malformed final answers cannot produce clean evidence. Tool continuations add no provider retries. Topology contributes one aggregate stage receipt; per-dispatch journals remain attribution evidence and are never added into totals twice.

### Policy identity and diagnostics

Bind broker, context validator, repository settings, portable skill and runtime manifest into final-review policy digests, together with the newly effective main/advisor identities and allowance policy. Prior full-model or earlier-policy evidence cannot authorize reuse. Keep the existing result schemas, exact-head checks, severity rules and final publication evidence.

Upload only sanitized main/advisor receipts, event journals, tool counters and fixed expectation counters with existing seven-day retention. Extend final/stack log and summary estimates to show Flash main, full-model advisor and combined costs using existing aggregate formulas. Missing, invalid, unfinished or absent expected receipts remain unknown/partial, including cancellation; no missing spend becomes zero. Main OCR budget counters continue to exclude the separately accounted advisor allowance.

### Ownership and sequence

1. Main owns the frozen plan, policy decisions, integration and delivery. The configured executor may own the existing broker module/tests after the helper and allowance API is frozen; acceptance is persisted admission, focused-source isolation and cancellation tests. No shared-file writers overlap.
2. Main owns provider-aware dispatch, final/stack and workflow wiring, topology continuation, policy invalidation and synthetic integration verification. Dependencies are the broker helper API and allowance contract above.
3. Main owns portable skill/docs, manifest refresh, complete source review, runtime commit followed by caller-pin commit, ordinary push and one draft PR. Runtime assets at the selected pin and final candidate must verify identically; fresh exact-pin retrieval is required.

### Verification portfolio

| Independent risk | Verification |
| --- | --- |
| Shared quota, worker concurrency, resume, cancellation and corrupt state | Extend existing broker/final tests; no added retries or reset |
| Frozen source, request bounds and credential isolation | Existing broker/adapter/draft synthetic contracts, with unrelated-source sentinels excluded from advisor requests |
| Topology continuation, aggregate deadline/token/byte bounds and invalid output | Extend existing stack tests with synthetic model/tool responses |
| Correct model routing, policy invalidation and main/advisor accounting | Existing final, stack and adapter contract suites, including missing-receipt cases |
| Stock/patched compatibility and immutable delivery | Existing actual stock fixture, patched-engine checks, manifest and caller-parity contracts |
| Portable skill wording and live model quality | Main source inspection; no prose-pinning tests and no paid replay |

No application runtime is needed. Use the retained isolated Node 24 tool container and synthetic providers, repository formatters, staged data/secret inspection and Gitleaks. Required simplification, risk review and integrated final review cover the complete committed package. Preserve current reviewer-route approvals and live acceptance boundaries.

## Progress

Root outcome is lower full-model context exposure and cost through focused advisor consultation, authorized by the user's current instruction. The first useful acceptance is a synthetic Flash reviewer successfully consulting the full-model advisor while unrelated source/history stays outside its request and a resumed process cannot regain consumed attempts. Baseline broker contracts pass 17/17 with zero skips. The Flash main routes, shared focused-advisor lifecycle and bounded topology continuation are implemented. Integrated draft/final/stack/adapter contracts pass; actual stock draft/provider contracts and broker contracts pass, with one obsolete final-route guard assertion corrected. Full source review and caller-pin parity are next. The package is cohesive across the broker, final controller and workflow seam; it remains one ordinary PR as explicitly requested. No additional dependencies or runtime services were introduced. Planner round one requested explicit shared lifetime, topology bounds, source limitations, identity invalidation and a fixed verification portfolio; those are resolved in this draft, which passed planner round two. Required delivery is one reviewed draft PR, followed by separately authorized merge and ordinary live qualification.

Simplification review accepted two reductions in atomic file writes and topology request construction; 93 affected broker/topology contracts pass with zero skips. Actual stock/caller qualification passes 29/29 with zero skips, and integrated final/guard contracts pass 74/74. Risk and integrated final source review remain pending. Local Biome reports two existing forEach callback-return errors in unchanged final validation; formatting passes. Focused Opengrep reports no findings with one existing regex parse limitation. Staged content was inspected; Gitleaks passes. The data-hygiene hook flagged environment bindings and synthetic fixtures, so its documented verified-false-positive override was used for the implementation commit.

Integrated final review identified an advisor-error propagation defect in topology and a redundant allowance test. The correction feeds fixed recoverable tool errors back to Flash, hides the tool when the shared allowance is exhausted and keeps cancellation, malformed results and deadlines blocking. Removed the duplicate test. Main inspection additionally tightened persisted identity revalidation and unexpected-receipt cost handling. All 222 affected adapter/broker/topology contracts pass with zero skips. Risk review and the focused final-review correction pass remain pending; hosted CI and ordinary live acceptance are separate.

Final source inspection verified upstream first-match rule resolution and corrected final guidance composition so the effective rule includes the portable procedure. The existing wrapper fixture now protects both trusted inputs. Advisor-only timeout and transport failures remain explicit tool gaps while the topology signal/deadline and diagnostics failures still block. All 201 affected adapter/topology contracts pass with zero skips; source review dispositions and current-head CI remain tracked privately.
