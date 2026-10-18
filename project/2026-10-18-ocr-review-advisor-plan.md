# Reliable draft reviews with a bounded advisor

## Approval summary

Draft OCR should expose incomplete coverage, preserve native assistant state
through compressed history, and show useful progress without printing raw model
output. After those repairs, DeepSeek may consult the existing final-review
model through a bounded advisor tool. A repository-owned reviewer skill will
explain Klicker invariants and direct the reviewer to relevant skills and the
engineering documentation. The user approved this executable batch on
2026-10-18 and asked to begin with the reliability repairs.

Keep the pinned OCR 1.13.0 executable, current reviewer models and maximum
reasoning, existing OCR token limits, accounting formulas, timeouts, retry and
resume decisions. Advisor calls add a separate small quota and separately
reported Mistral usage; they never count as final-review approval. The proposed
quota is two attempted consultations per draft run, each with at most 16 KiB
of complete serialized provider input including instructions, tool schema and
retrieved context, a 16,384-token output ceiling and a 480-second end-to-end
deadline, without broker retries. Failures consume a slot. USD 0.20 is a
reference-price estimate, not a spending ceiling; actual usage and missing
receipts remain explicit.

Completion means verified source, synthetic integration evidence, independent
review, ordinary commits and push, and a draft PR against `v3`. No merge,
ready-state transition, live OCR replay, deployment, infrastructure, application
execution or preview environment is authorized by this plan. Future browser
testing and previews are recorded below for later decisions.

## Execution details

### Context and authority

- Approval mode: executable batch. Boundary owner: self.
- Repository: public `uzh-bf/klicker-uzh`; target `v3`, baseline
  `27421631db7a7c39d80e494ee1c00489622685fc`.
- Worktree: `trees/ocr-review-advisor`; branch `rs/ocr-review-advisor`.
- Execution mode: standard. Main owns design, integration, credentials,
  external effects and final proof. Leaf workers do not delegate or publish.
- Authority: implement the approved changes, run focused synthetic checks,
  commit, push the task branch, open/update its draft PR and address feedback.
- Pause: a required capability failure, a new provider/data boundary, an
  incompatible budget/retry change, or material delivery topology change.
- Related history: [OCR diagnostics clarity](2026-10-17-ocr-diagnostics-clarity-plan.md).
  Open PR #6531 separately patches the engine's compression/group sizing;
  this package does not adopt that patch or change the executable.

The package improves one draft-review pipeline for the same maintainer audience.
Use one ordinary draft PR with coherent commits; no stack topology is introduced.
Reassess packaging if a separate independently usable capability emerges.
No Klicker product primitive, application API or data model changes. The ADR
gate is not armed: this CI extension is reversible by source revert. Infrastructure
ownership or a deployed preview lifecycle would re-arm it.

### Evidence and research

Pinned upstream source is `alibaba/open-code-review` commit
`1672852136fc87748249d22bce0819f33419ea79`. It registers MCP tools in planning
and main tasks, supports stdio and Streamable HTTP, and skips failed MCP
initialization. Its MCP client forwards text and marks images unsupported.
The documented Agent Skill invokes OCR from a host agent; it is not an internal
skill loader.

The current automatic action prints result JSON and stderr. Its effective
settings are concurrency four, CLI default effort and budgets, 15-minute task
timeout, max model reasoning, sticky summary, incremental comment deduplication,
low-severity summary routing, and no raw artifacts. Cross-push checkpoint range
is disabled. Preserve these settings. The pinned publisher is reusable without
the action's unfiltered execution step. Use a direct Node runner, the unchanged
CLI and publisher helper from an explicit checkout of the exact upstream commit.
Do not patch or vendor the action or executable. Keep publisher inputs equivalent:
sticky and incremental true, overlap 0.6, batch 50, severity low, no category
routing or outdated-thread mutation. Keep checkpointing false and checkpoint
metadata empty. Fetch and verify the exact PR-head object; use the full merge-base
range against the trusted base. Preserve CLI language English, default effort
and token limits, 15-minute task timeout, concurrency four and 480-second LLM
timeout, plus the current max reasoning and session-affinity extra body.

Existing history tests protect exact-prefix and reasoned compressed replay,
collision rejection, usage and native-state bounds. Reproduce the missing-
reasoning case before selecting a repair. Do not accept arbitrary flattened
history, ambiguous identities, changed tool calls or missing usage as valid.

Two bounded explorers own upstream execution/publisher mapping and the replay
reproduction. Main verifies their findings. Existing Claude consultation
identified hidden nested usage, fail-open MCP startup, shared quotas, trusted
policy, source pinning and final-review independence as key obligations.

### Binding implementation contracts

1. Draft coverage reports selected, completed, failed, reused and waived counts
   from the manifest, with complete/partial/failed/unknown status. A green exit
   with partial coverage emits a visible warning; existing partial publication
   and exit semantics remain unchanged. Never label selected as completed.
2. Live logging reconstructs allowlisted progress, heartbeat and process-exit
   events. Keep raw streams private to runner scratch; do not print, upload or
   copy prompts, reasoning, source arguments, provider bodies or result JSON.
3. Native replay remains bounded and fail-closed. Any new compressed identity
   must have reliable source identity, collision detection and a reproduced
   regression. Preserve all prior identity tests and provider/accounting behavior.
4. One trusted MCP broker per OCR invocation exposes only `ask_review_advisor` and a bounded
   read-only review-context tool. The advisor uses Mistral `zai-glm-5-3` with
   max reasoning through the existing adapter code. Provider keys remain in
   adapter instances in the runner. The broker runs in that trusted parent and
   holds the advisor capability in memory. OCR receives only a broker-specific
   loopback URL/token and its DeepSeek capability, never the advisor capability,
   provider keys or publication token. Use an explicit child environment allowlist.
   One remote MCP endpoint shares the broker across planning and all workers.
5. The broker pins the exact reviewed head and trusted policy revision. It
   validates paths, text blob modes, line ranges and byte bounds. Questions and
   candidate code are untrusted data. No caller-selected models/endpoints,
   arbitrary shell, write tools, recursive calls or broker retries exist.
6. The consultation quota covers all four workers and planning, reserving a
   slot before asynchronous work. Report available/unused/consulted/unavailable,
   attempted/completed/rejected calls and incomplete usage. Startup preflight
   must prove registration, not just a config file's existence. Production
   preflight initializes and lists tools only; it consumes no consultation. A
   broker startup failure continues ordinary review with visible unavailable.
   Advice requires exactly one forced `review_advice` result with assessment
   `likely_issue`, `not_issue` or `uncertain`, a bounded answer and up to four
   validated source references. Reject length finishes, malformed results and
   responses above 256 KiB. Return no reasoning. CLI exit, MCP disconnect and
   job termination cancel broker fetches and close adapters with bounded cleanup.
   Unsettled requests retain incomplete accounting.
7. Keep DeepSeek and advisor receipts separate and price each with its own
   provider profile. A combined estimate requires complete receipts for both;
   unknown usage is never zero. Cached input retains existing accounting rules.
8. Add `.agents/skills/rs-ocr-reviewer/SKILL.md`. Bootstrap it through trusted
   merged rules and explain on-demand discovery of relevant `.agents/skills/`
   guidance and `docs/`. Treat referenced developer instructions as review
   context; they grant no execution or mutation permissions. Read policy and
   documentation from the trusted revision, never candidate executable policy.
9. The final-review workflow stays separate and retains its current eligibility,
   authorization, reasoning, limits, accounting, retries and publication gates.

### Ownership and sequence

Delegation Map: slice 1 belongs to main; slice 2 belongs to main, with one native
executor owning only its broker module and tests; slice 3 belongs to main. Slice 2
depends on slice 1; slice 3 integrates both. The exact new files are
`.github/scripts/ocr-draft-review.cjs`, `.github/scripts/ocr-draft-review.test.cjs`,
`.github/scripts/ocr-review-tools.cjs`, `.github/scripts/ocr-review-tools.test.cjs`,
and `.agents/skills/rs-ocr-reviewer/SKILL.md`. Extend existing adapter/tests, draft
workflow, parsed workflow guard, `check.yml` suite list and
`docs/ci-and-deployment.md`. Qualification uses these suites with the pinned
local binary and temporary synthetic fixtures, without a second fixture framework.

| Workstream | Owner | Acceptance boundary |
| --- | --- | --- |
| Replay reproduction and upstream action mapping | Bounded explorers, integrated by main | Source references and a synthetic failing case |
| Draft reliability, runner and workflow wiring | Main; coupled trusted execution seam | Focused runner/adapter tests and pinned-CLI qualification |
| Advisor broker and its focused tests | Executor after interfaces settle | MCP calls, quota, isolation and result validation |
| Reviewer skill, docs and future plan options | Main | Trusted loading and relevant links; no prose-pinning tests |
| Simplification, risk review and final review | Configured specialists | Immutable committed range; main dispositions findings |

1. **Reliable draft execution.** Extend the adapter's replay seam only after
   reproduction. Replace unfiltered draft execution with a repository-owned
   runner using the unchanged pinned publisher. Extend existing diagnostics
   and progress protection. Commit the coherent repair after focused checks.
2. **Advisor and trusted review context.** Add one broker module and its tests;
   wire ephemeral MCP configuration, a separate Mistral adapter, bounded
   consultations and cost/status receipts. Add the repository reviewer skill
   and update `docs/ci-and-deployment.md` in this slice. Commit after offline
   qualification; no new repository dependency is planned.
3. **Integrated delivery.** Simplify, review changed trust/usage/replay seams,
   verify the combined source, scan staged data, push and create a draft PR.
   Inspect exact-head CI and ordinary feedback; preserve required human review.

### Test portfolio

| Consequential behavior | Obligation | Primary seam and existing protection | Distinct failure |
| --- | --- | --- | --- |
| Native replay across compression | Extend existing | Adapter HTTP/history suite | A known native turn loses echo reasoning after prefix rewrite |
| Honest coverage and filtered live output | Extend existing | Progress/CLI tests plus draft runner contract | Partial green result or raw reasoning appears as complete/public output |
| Advisor isolation and shared limits | Add new | Synthetic MCP client and mock loopback advisor | Concurrent workers exceed quota, escape source scope or recurse |
| Advisor structured result and costs | Add new | Mock provider through existing adapter and summaries | Malformed/truncated advice is accepted or missing usage priced as zero |
| Skills/docs are trusted and bounded | Add new | Broker context reads from synthetic Git revisions | PR changes replace policy or a symlink/path escape reaches runner state |
| Existing review behavior | Extend existing | Parsed workflow guard and pinned publisher fixture | Models, effort, budgets, retries, retention or deduplication drift |

Use repository Node test suites, Biome/Prettier, syntax/diff checks, staged
Gitleaks and relevant Opengrep. No application runtime or browser verification
is needed for non-rendered CI code and review instructions. Existing dependency
guards may skip whole-app host hooks; report that and rely on required CI.
The replay repair may bind the unchanged per-conversation `prompt_cache_key`
together with exact assistant/tool identity, refusing collisions and cross-task
matches. A globally unique flattened turn or reused tool ID alone is not
sufficient provenance. Stop that repair if synthetic CLI traffic cannot establish
trustworthy identity; continue independent reliability work and report the limit.

The actual pinned CLI must register and invoke the MCP tool against synthetic
providers, exercise deliberate unavailability, preserve existing flags, and
emit bounded coverage/progress/cost receipts. Synthetic proof is not live
provider or trusted-default-branch activation proof.

### Future options: testing and preview environments

Future work is planning-only here. Start with read-only exact-head CI/test
receipts. A later opt-in isolated browser tester could run bounded Playwright
journeys with synthetic fixtures and return assertions, console/network errors,
screenshots and trace links. Another option is bounded test selection through
an allowlisted harness rather than arbitrary commands. Neither requires the
reviewer to own deployment credentials.

PR previews could reuse that isolated runtime as a human-accessible environment.
Consider short-lived CI sandboxes, per-PR namespaces with synthetic databases,
and deployment-platform previews. A persistent preview needs an explicit owner,
cost quota, authenticated audience, immutable source identity, routing/TLS,
dependency isolation, egress policy, migrations, expiry and cleanup on closure
or supersession. Untrusted fork code must not receive provider credentials,
real data, write-capable tokens or a host/container-control socket.

Keep execution outside the privileged `pull_request_target` review job. Admit
only versioned evidence for the exact PR commit into review context. DOM/text
tools are compatible with current MCP results; direct screenshot reasoning
requires qualified image transport/model support or a separate vision tester.
Deploying previews, opening network access, changing infrastructure ownership,
running application code or adding recurring costs requires a later approved
implementation plan. The first future decision is which preview audience and
runtime owner justify a retained environment rather than a disposable CI run.

## Progress

- Status: planning and bounded reproduction; user execution approval recorded.
- Current branch is clean at the baseline before this plan; primary unchanged.
- Baseline: 214 focused adapter/individual/stack tests passed.
- Planner round 1 requested concrete isolation, enforceable bounds, cancellation,
  runner/publisher parity, exact artifact ownership, replay provenance and explicit
  startup/qualification semantics. All accepted in this revision.
- Optional AGY rival consultation unavailable: CLI reported missing authentication.
  No login, configuration or provider change attempted.
- Astra planner round 2: APPROVED. Both rounds retained privately under
  `project/_local/reviews/`. No paid OCR run triggered.
- Required delivery: reviewed source and draft PR against `v3`; achieved: worktree
  and plan draft. Next: settle execution and replay seams, harden the plan, then
  implement reliability before advisor wiring.
