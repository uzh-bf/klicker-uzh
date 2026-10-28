---
title: Shared OCR runtime
description: Immutable action releases, trusted repository settings and offline qualification.
---

# Shared OCR runtime

The runtime keeps review execution in one public source release. A repository
owns its event admission, permissions, concurrency, trusted policy and activation.
The action owns the repeated draft execution and publication steps. The
[distribution decision](adr/0055-pinned-ocr-source-runtime.md) explains this split.
The operator procedure remains `rs-ocr`; the model-facing procedure remains
`.agents/skills/ocr-reviewer/SKILL.md`.

Klicker's draft workflow selects the action through the full commit SHA in
`.github/workflows/check-ocr-review.yml`. It retains one repository-owned
job with the existing admission and execution policy; repeated draft steps live
in that pinned release. Individual/stack final controllers retain their existing
execution and admission. Other callers migrate independently after donor
qualification. Native GitLab still needs a qualified trusted controller and
publisher for its selected instance; the Node runtime alone does not establish
that support.

## Release identity

`.github/open-code-review/runtime-manifest.json` binds the action, controller,
runner, adapter, tools, context validator, pure helpers, portable skill and
patched installer/patch by SHA-256. The controller verifies the complete asset
inventory with Node built-ins before importing runtime modules. Symlinks,
missing assets and changed bytes are rejected. The action source must be pinned
by its complete Git commit; mutable refs are rejected. The manifest records no
enclosing commit hash, avoiding a self-reference.

Draft and final main reviews use `deepseek-v4-1-flash-1017` at maximum reasoning.
The fixed Mistral profile is `mistral-deepseek`; its upstream remains
`/v1/chat/completions`. Mistral's [Responses preview](https://docs.mistral.ai/studio/conversations/responses)
is stateless and still requires resending prior output, so it does not replace
the adapter or reduce context automatically. Responses transport needs its own
history, tool-call, terminal-state and usage qualification before adoption.

The full `zai-glm-5-3` model is available only through focused advisor
consultations at maximum reasoning. Each request contains one question and
selected source excerpts; it receives neither the complete diff nor the
reviewer conversation. The portable skill directs difficult and architectural
questions to that advisor after source inspection.

The draft profile uses stock npm `@alibaba-group/open-code-review@1.13.0`,
`deepseek-v4-1-flash-1017` through Mistral and the existing bounded `zai-glm-5-3` advisor.
Verification checks the stock version and the immutable upstream publisher's
digest. It does not claim platform-specific stock binary digest verification.
Final execution keeps its separate pinned upstream source, compression patch,
Go toolchain and executable provenance. The shared action does not run final
review or grant its approval. Final code review attaches the same bounded
advisor and trusted-context tools through its ephemeral OCR configuration.
Final rules use first-match resolution, so the wrapper combines the portable
procedure with every existing rule before supplying it to OCR; a later matching
rule alone would leave the procedure inactive.
Stack topology can consult the advisor within its existing aggregate output
allowance and deadline, then returns the existing strict final result.

The advisor permits eight attempts shared across each review job, including
workers, code ranges, resume and topology. Its private allowance is initialized
once; unavailable or corrupt continuation state cannot reset it. Each attempt
retains the existing source/request/output bounds. Failed and cancelled attempts
consume allowance. Advice remains evidence for the main reviewer, which owns
coverage and final findings. Advisor costs are reported separately and included
in the combined model estimate; they retain separate application accounting.
Missing expected receipts prevent a complete estimate.

Repository context uses the existing `ocr-repository/v1` configuration at the
frozen trusted policy commit. It admits context roots, root Markdown contracts,
guide pointers and public-library IDs, with no model or operational overrides.
The portable skill at that revision must exactly match the release-bound skill.
An upgrade changes the action pin and skill together through a reviewed source
change. Configured keys do not activate private-source review or public docs
lookup; the repository's admission policy owns those decisions.

## Runtime commands

The action resolves `.github/scripts/ocr-controller.cjs` relative to its own
`github.action_path`. `GITHUB_WORKSPACE` identifies the separate trusted caller
checkout, and `RUNNER_TEMP` holds private execution files. No runtime script is
loaded from candidate source. Library callers can pass `root`, `repo`, `temp`
and `publisherRoot` explicitly; the legacy runner CLI retains its prior defaults.

| Command                                     | Boundary                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `verify-release`                            | Checks release assets and complete action ref; emits fixed install/publisher outputs.                                          |
| `prepare`                                   | Validates the GitHub draft event and repository identities, freezes policy/head/base/range and validates trusted config/skill. |
| `verify-install`                            | Verifies stock CLI version and publisher source digest.                                                                        |
| `run`                                       | Supplies frozen caller inputs to the existing runner, preserving its exit code and credential isolation.                       |
| `validate`                                  | Produces the exact-head publication envelope, retaining partial coverage.                                                      |
| `summary`                                   | Prints the existing estimated cost, caching savings and outcome diagnostics.                                                   |
| `check-caller <workflow.json> <policy-sha>` | Validates a parsed workflow and trusted configuration against a release.                                                       |

`prepare` uses the repository token only in temporary fetch-process environment
configuration. It never writes authentication to Git config or passes it in
arguments. Metadata reads and OCR child processes receive credential-free
environments. Provider keys enter only the review step; the token enters
checkout/fetch and publication. Publication rechecks the current open draft head
and validates the result before loading the verified upstream publisher.

The private `ocr-action-context.json` includes bounded PR metadata and is never
uploaded. `ocr-runtime-identity.json` contains runtime repository/ref, manifest
digest, frozen policy/source identities and config/skill digests. It joins the
existing sanitized diagnostics artifact with seven-day retention. Raw result,
stderr, prompts, source excerpts and reasoning remain outside that artifact.

Review failure still fails the action even if validated partial findings publish.
Invalid results, cancellation and superseded heads cannot publish. Publisher
and artifact failures fail the action. Summary failure remains best-effort. No
retry, resume, accounting or budget policy is added by this controller.

## Incremental usage and context evidence

The current source adds a separate `.events.jsonl` sidecar beside each adapter
usage receipt. The draft and advisor have separate sidecars; individual and
stack final sidecars also include their preflight or topology calls. Attempt events
have a random invocation identifier and attempt ordinal. Dispatch, parsed
response and terminal outcome are distinct events. Response usage is written
before response validation, so a rejected completion can retain observed usage
without changing aggregate accounting. Missing or invalid usage stays null.

Response events also record `reasoning_bytes`, `content_bytes`, `tool_calls`
and `tool_arguments_bytes` from the normalized first assistant choice, including
length-limited responses and partial argument strings. These UTF-8 byte counts
contain no response content and do not estimate tokens. Unsupported message
shapes produce null shape counters; a supported empty message produces zeros.
`reasoning_tokens` retains an optional provider-reported count only when it is
a safe nonnegative integer no larger than valid completion usage. Missing or
invalid counts stay null. These fields explain response shape independently of
validation and never affect review budgets, cost accounting or retries.

The journal contains only fixed provider/model/stage labels, opaque conversation
IDs, numeric counters and bounded outcome codes. It excludes prompts, source,
arguments, reasoning, raw errors and provider-generated IDs. Synchronous writes
preserve completed rows across process termination; an unfinished dispatch
still has unknown usage. A hard runner loss can prevent artifact upload. Each
sidecar is limited to 8 MiB and each invocation to 16,384 rows, including a
truncation marker where space permits. I/O failure emits a fixed warning; the
long-lived adapter also retains journal status in its aggregate diagnostic
snapshot. These diagnostic failures never change review execution or retries.
Sidecars have seven-day retention alongside existing sanitized artifacts.

Broker `tool_results` count successful serialized results and their UTF-8 bytes
for the three fixed tools, including discovery, pagination and cached lookups.
They exclude transport envelopes and unsuccessful calls. The shared broker
cannot attribute these counts to individual workers. Adapter conversation
`observed_tool_results` instead count tool-result content replayed in model
input, once per call ID within that adapter lifetime. These observations can
include errors and omit results removed by compression or never sent back to
the model. Missing conversation keys, the 256-conversation limit and the
2,048-result deduplication limit remain explicit diagnostic gaps; observed
input bytes are not authoritative broker-read bytes or billable tokens.

Cost summaries add `OCR cost_components` per stage: uncached input, cached input,
output and cached share of estimated charge, using existing pinned prices.
Incomplete stages have unavailable components. Existing total/savings lines,
budget units and aggregate receipt formulas remain unchanged. Event rows are
never summed into those totals or treated as complete billing evidence.

Draft callers use the diagnostics shipped by their selected immutable runtime;
final workflows use the merged repository-owned adapter source. A runtime source
change alone does not establish which draft implementation is active.

## Prepare a caller upgrade

For donor changes, include the runtime and caller adoption in one PR:

1. Commit the complete runtime and updated asset manifest. Record that commit's
   full SHA before changing the caller.
2. In a later commit on the same branch, pin
   `OWNER/REPOSITORY/.github/actions/ocr-review@FULL_COMMIT_SHA` to that runtime
   commit. Push both commits to the action's existing repository.
3. Qualify the selected release and compare its verified manifest with the final
   candidate's verified manifest. Equal manifests bind equal runtime assets;
   later runtime changes require another runtime commit and refreshed pin.
4. After merge, read back the caller, verify the merged runtime still matches
   the selected release and confirm that the exact pin remains retrievable.

The source SHA remains immutable across a squash merge. Ordinary codebase CI
explicitly fetches that exact commit from the fixed public donor origin before
its local `git show` and `git archive` checks. It clears credential helpers and
GitHub authorization headers, changes no refs or checkout, and never executes
the fetched candidate. A fresh checkout can otherwise omit a pre-merge commit
after its branch is deleted. Present fetchability is evidence for the selected
commit, not a promise of indefinite forge retention; an unavailable pin blocks
qualification and needs an ordinary source correction.

Keep independent adopter upgrades in their own release cadence. A later
adopter can select an already merged release; a second donor PR is not required
merely to replace a qualified source pin with its squash-merge SHA. Neither a
guessed squash hash nor a mutable action ref is distribution proof. GitLab needs
equivalent exact-revision retrieval and runtime-parity checks through its own
qualified adapter before using the same one-MR procedure.

The caller keeps one `ocr-review` job with `pull_request_target` draft admission,
read-only contents and review-write permissions, its existing concurrency group,
a 45-minute timeout and `OCR_NO_UPDATE: '1'`. Its only execution step is the pinned
action with these explicit bindings:

```yaml
with:
  mistral-api-key: ${{ secrets.MISTRAL_API_KEY }}
  context7-api-key: ${{ secrets.CONTEXT7_API_KEY }}
  github-token: ${{ github.token }}
  provider-paused: ${{ vars.OCR_PROVIDER_PAUSED }}
```

The workflow resolves the trusted repository pause variable and passes it as an
action input. The composite reads the input only in the review step; the `vars`
context is unavailable inside composite action metadata. Omitted
or empty input keeps provider calls enabled, `true` pauses them, and invalid
values fail closed.

Do not expose these credentials through job-level environment variables.
Repository-specific activation can narrow the normal draft expression and must
be supplied explicitly to the shared caller checker. The checker never enables
that activation. Caller migration also updates its portable skill and trusted
context configuration, then removes obsolete controller copies only after shared
behavioral contracts replace them.

For an offline check, parse YAML with the repository's installed parser and pass
the resulting JSON to `check-caller`. The donor's central contract test extracts
the declared runtime assets from that exact Git revision and calls its actual
checker against the frozen caller policy. Its CI checkout therefore retains full
history; a missing release object is an error, not a skipped check. The existing
config and portable skill already match this first donor release.
Set `OCR_ACTION_REF` to the complete pinned
source revision, `OCR_ACTION_REPOSITORY` to its owner/repository, `GITHUB_WORKSPACE`
to the trusted caller checkout and `RUNNER_TEMP` to the task's temporary directory.
When activation is present, set `OCR_CALLER_ACTIVATION` to that exact additional
expression. Configuration and skill are read from the supplied policy SHA,
never from candidate files. Runtime dependencies are Node built-ins; YAML
parsing remains an offline development dependency.

## Qualification and recovery

The central suite mutates pins, caller permissions, admission, execution steps,
credentials and frozen context. Synthetic independent runtime/caller repositories
exercise asset tampering, hostile duplicate scripts, missing/mismatched skill,
partial publication, supersession and failure conclusions. Existing runner/tool
and individual/stack final suites protect the retained execution contracts.

Shared-runtime changes select a hosted offline qualification step that installs
stock OCR into a temporary prefix and supplies `OCR_TEST_BINARY`,
`OCR_TEST_PUBLISHER` and `OCR_REQUIRE_STOCK_BINARY=1` to the central and existing
native fixtures. Providers and tools are synthetic. Missing fixtures fail that
step; a skipped native test in another suite is not qualification evidence.

Source checks, hosted offline qualification, merged policy and live provider
acceptance are separate evidence. Observe the next genuine ordinary review at
its actual policy/runtime identities before claiming live acceptance. An extra
paid replay remains separately authorized. Roll back by selecting the previous
qualified action/config/skill set through a source revert; changes to live
activation or credentials retain their own authority.
