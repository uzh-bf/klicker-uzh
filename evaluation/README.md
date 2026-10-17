# Evaluation

Klicker evaluation runs use the private, transport-neutral framework in
evaluation/framework. The launcher keeps target credentials separate from judge
credentials and supports reproducible local checks without starting the
Klicker application stack.

- `framework/` is the UZH-internal evaluation submodule. It is private and
  intentionally skipped by regular clone and CI workflows.
- `data/` contains committed synthetic evaluation assets, including ground
  truth cases under `data/ground_truth/`. Do not add production or personal
  data.

## Evaluation policy

Use **DeepEval** through `evaluation/framework` for LLM answer quality, RAG,
prompt and agent evaluations. Configure built-in metrics or GEval in YAML and
use the existing launcher and reports. New bespoke LLM judges, parallel scoring
engines and quality services are outside this repository's evaluation path.
Product adapters may capture evidence and normalize QA records. Deterministic
contract tests, token preparation, latency statistics and budget/accounting
controls support evaluation without replacing DeepEval quality metrics.

Routing benchmarks capture answers with explicit `--no-judge` and import saved
answers into standard framework QA. The routing quality YAML supplies GEval
correctness, completeness, clarity and major-error checks through the existing
launcher. Pairwise comparisons use native DeepEval Arena with the framework's
judge factory. The replaced custom prompts, verdict parsers and scoring helpers
are removed; historical reports remain readable for analysis. See the
[routing workflow](routing/README.md). Manage-assistant quality checks already
use DeepEval and retain their own suite.

## Trajectories and provider admission

Experiment orchestration, numeric references and the shared spend guard live in
`evaluation/`. Chat retains the application transport, authored-corpus validation,
canonical source mapping and persisted-history verification in
`apps/chat/scripts/`. Generic import, assessment and reporting belong to the
private framework; these app checks remain covered by Chat's focused tests.

The framework compatibility change is coordinated with
[framework draft MR 54](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/54).
Land that change first, then reconcile this repository's framework pin to the
final merged revision before landing the Klicker change.

### Offline capture import

With the pinned framework dependencies already installed, import sanitized
version-2 receipts and their authored corpus without querying a model:

```bash
uv run --frozen --offline --project evaluation/framework \
  python evaluation/framework/src/adapters/klicker_trajectories.py \
  project/_local/tutor-baseline.jsonl \
  --corpus evaluation/data/trajectories/tutor-attribution-v2.json \
  --group development --output project/_local/tutor-baseline-conversations.json
```

The output must be new; import never replaces an existing artifact. It preserves
all planned cases, including incomplete and unstarted captures. Complete Tutor
and Explainer captures are eligible for explicit framework assessment; Quizzer
remains unsupported and unassessed. Assessment limits select eligible cases
without shrinking planned coverage. Rubrics supply expected outcomes, while
hashed source mappings remain diagnostics without retrieval context. The corpus
hash records import provenance; capture-time corpus identity is caller-attested.

Import is offline. Later judge execution requires separate approval and an
explicit profile. The target spend guard bounds application requests only;
the framework's post-completion judge-cost reporting is not a shared hard cap.

### Provider admission

`evaluation/run-tutor-trajectories.mjs` accepts synthetic Tutor, Explainer
and Quizzer corpora. Receipts reconstruct citation positions with the application's
source mapper, including cross-call duplicates and null indices for overflow.
The receipt includes every application-recognized retrieval server; the local
trajectory's first-turn grounding check still requires `KB_doc_query`.
They contain hashed identities and numeric page/video positions, not source text,
titles or URLs. Reconstruction from persisted tools does not establish the exact
historical model input. Receipt version 2 identifies the mapper fingerprint.
Identity hashes are deterministic diagnostics, not anonymization: candidate
titles or URLs may be guessed and checked against them. Keep receipts private
even when they omit raw identifiers; operator corpora must remain synthetic.

Both the trajectory CLI and the listening evaluation target require a shared
version-2 budget for operator runs. Application credits remain observational;
they are not provider dollars. The budget admits at most 120 submitted turns and
US$5 of conservative provider reservations across all arms. Each upstream model
step or retry reserves its qualified full input-context cost plus its bounded
output cost before dispatch. Reservations are retained on success and failure.
This may exhaust the dollar cap long before 120 turns.

Set `KLICKER_EVAL_PRICING_FILE` to a private JSON policy with this shape. The numbers
below are synthetic examples, not tariffs or provider qualification:

```json
{
  "version": 1,
  "provider": "synthetic",
  "upstreamOrigin": "https://synthetic.example/v1",
  "qualification": "Evidence of enforced context/output bounds and upper tariffs",
  "models": {
    "synthetic-model": {
      "contextTokens": 1000,
      "maxOutputTokens": 100,
      "inputMicroUsdPerMillion": 1000000,
      "outputMicroUsdPerMillion": 2000000,
      "outputIncludesReasoning": true
    }
  }
}
```

Use provider-enforced architectural context bounds and conservative upper prices
for the exact provider/model route, including reasoning tokens. One dollar is
1,000,000 microdollars. The guard accepts only text `/v1/responses` and
`/v1/chat/completions` requests with an explicit `max_output_tokens` or
reasoning-inclusive `max_completion_tokens`, respectively. Unpriced models,
legacy `max_tokens`, hosted tools, multimodal input, multiple completions,
provider price overrides and redirects fail closed. Function tools execute in
the application; their separate paid egress must be qualified independently.
The guard accepts only the exact two true `cache` bypass flags emitted by the
application, then removes this proxy-only field before forwarding. A nonblank
native `prompt_cache_key` of at most 64 characters is preserved. Other cache
objects and unknown request fields remain unqualified.

Choose a new private `KLICKER_EVAL_BUDGET_FILE`, then initialize it offline once:

```bash
node evaluation/evaluation-spend-guard.mjs --initialize-budget
```

Initialization creates an immutable `.identity` receipt alongside the mutable
ledger. Never replace an exhausted, interrupted or legacy ledger to resume the
same experiment. Legacy application-credit budgets must be retained as historical
records; create a new explicitly authorized experiment instead. Mutation `.lock`
and run `.run` leases fail closed if held or left by interruption. A responsive
Unix socket `.lease` proves that the run owner is alive; runner and guard must
share the same local OS/filesystem. Guard restarts reject uncertain ledgers. Investigate
such state before recovery; there is no automatic reset or refund.
Interrupted initialization can leave an identity receipt without a ledger; retain
it for investigation rather than retrying initialization at that path. Failed
ledger replacements may retain temporary files as diagnostic evidence. Do not
promote those files or remove stale locks automatically.

The approved evaluation-only route is application → local spend guard → qualified
upstream. Inject `KLICKER_EVAL_GUARD_KEY` and `KLICKER_EVAL_UPSTREAM_KEY` at runtime
through the existing secret operator. Set `KLICKER_EVAL_UPSTREAM_ORIGIN` to the
OpenAI-compatible API base (for example `https://<qualified-host>/openai/v1`).
Run `node evaluation/evaluation-spend-guard.mjs` in the guard process.
It prints its port, binds to loopback by default and sends only authenticated
model requests upstream. Container access requires an explicitly selected private
`KLICKER_EVAL_GUARD_HOST`; exposing it publicly is outside this workflow.
The guard's `timeoutMs` bounds the entire upstream exchange, including streamed
output, and defaults to 120 seconds. A timeout retains its spend reservation and
may leave the interrupted target turn uncertain.

The evaluation application's `OPENAI_BASE_URL` must point to that guard's `/v1`
and its `OPENAI_API_KEY` must be the guard key. Keep the upstream key only in the
guard process. Prove that all model steps, summaries, retries and other billable
paths traverse the guard before a paid run. Auto routing is unqualified because
classifier/embedding requests can bypass this text-model seam. Pin the fixed
`KLICKER_EVAL_MODEL_ID` (default `gpt-6-luna`); an `auto` arm label grants no Auto
routing. The qualified provider must support the application's fixed low
reasoning effort and explicit output bound.

Set `KLICKER_EVAL_GUARD_ORIGIN` in the application process as well as the runner.
When present, the application rejects a mismatched default endpoint and any
chatbot-specific base URL or key before constructing the provider. The origin
must be canonical and local, without a path, query or credentials. Without this
opt-in, ordinary chatbot routing retains its existing behavior.

Use the existing `CHAT_MODEL_REGISTRY_JSON` override to distinguish the selected
application ID from the upstream deployment ID. For example, an evaluation-only
`gpt-6-luna` entry can use `deploymentId: "openai/gpt-6-luna"` for a qualified
OpenRouter route. Preserve the registry's fallback and usage policy requirements.
Key the guard's pricing policy by the deployment ID actually sent upstream;
keep the runner and receipt `modelId` equal to the application selection ID.
Do not change the production registry or infer qualification from this example.
For guarded Responses requests with a positive selected effort, the application
uses the registry's reasoning capability to set the SDK's `forceReasoning`
override. Otherwise prefixed model
aliases can lose their requested reasoning effort during SDK serialization.

For managed local startup, pass the guard origin, base URL, key, registry JSON
and a fresh nonsecret `KLICKER_EVAL_GUARD_GENERATION` to `post-start.sh`. These
explicit settings survive canonical development environment sourcing. The
managed process fingerprint includes routing settings and the generation,
never key values. Change the generation whenever credentials change and use
the owned process helper for replacement. Runner and guard still need the same
local OS/filesystem for their live lease.

Save that proof in a private `KLICKER_EVAL_QUALIFICATION_FILE`: `version: 1`,
`experimentId` and `policyHash` from the initialized ledger, exact `guardOrigin`,
`chatOrigin`, `chatbotId`, `modelId`, canonical policy `upstreamOrigin`,
`allBillableEgressGuarded: true`, and a nonempty
`evidence` reference. Export the same `KLICKER_EVAL_GUARD_ORIGIN` (without `/v1`)
and runtime-injected guard key to the runner. It checks the receipt and authenticated
guard status before login; reachability alone is not routing proof. Keep policies,
receipts, ledger and synthetic transcripts in approved private custody, outside Git.
Named `.localhost` routes rely on the qualified local development resolver.
Verify that each guard route resolves to loopback; use literal `127.0.0.1` or
`[::1]` when that resolver is unavailable. Endpoint-string checks alone do not
establish network routing.

Zero-spend qualification can exercise the real application with a fake local
Responses upstream, including SDK retries, MCP execution and persistence. Use
the ledger lease and turn primitives directly for this diagnostic; the paid
runner's prior-qualification gate remains intact. Record a separate synthetic
wire-proof artifact. It is not a positive real-provider qualification receipt
and establishes neither provider capabilities nor chatbot answer quality.
Current tariffs and paid experiments require their own approved environment
and spend boundary.

## One-time setup

Use the repository's pinned Node 24 and pnpm versions. pnpm warns about missing or
stale workspace dependencies without installing them before scripts. Evaluation
runs through uv and does not require the monorepo dependencies or an application
build. For application work, install dependencies with `pnpm install --frozen-lockfile`.

The pinned framework is a private submodule. Developers with GitLab access
materialize it explicitly:

```bash
git submodule update --init --checkout evaluation/framework
uv sync --frozen --project evaluation/framework
```

### Standalone Docker judge

Start only the evaluation judge in a separate terminal. It uses Azure's
OpenAI-compatible `/openai/v1` endpoint and the `gpt-5.6-luna` deployment.
Start it from the repository root after logging in to the team's Infisical instance:

```bash
python3 util/klicker-eval-judge.py
```

The helper reads missing `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_BASE_URL` from
Infisical using the existing repository `.infisical.json`, environment `dev`, and
secret path `/`. Existing nonempty environment values take precedence. The native
CLI uses its normal domain configuration (`INFISICAL_DOMAIN` or the repository's
Infisical configuration for a self-hosted instance). No operator installation,
`LITELLM_*` exports, or evaluation JSON configuration is needed.

Agent runs use the restricted operator's existing allowlist:

```bash
rs-infisical-operator --profile klicker-dev run \
  --map AZURE_OPENAI_API_KEY=AZURE_OPENAI_API_KEY \
  --map AZURE_OPENAI_BASE_URL=AZURE_OPENAI_BASE_URL -- \
  python3 util/klicker-eval-judge.py
```

The helper runs Docker in the foreground. Stop it with Ctrl-C. It binds only
`127.0.0.1:4000`, needs no database, and forwards the two upstream settings
through stdin into process memory. It does not put them in Docker environment
metadata or configuration files. This local gateway has a fixed development-only
key; do not expose it to a network or use this configuration for a shared service.
The image is pinned by digest. The helper accepts local Unix sockets or Windows
named pipes and rejects SSH/TCP Docker contexts before sending credentials.

Without judge overrides or an `evaluation/config.local.json`, judge modes select
this local gateway automatically. They fail before evaluation if it is not running.
`--check` remains offline and does not prove gateway access. Target-only modes
never select a judge. Explicit configuration, including incomplete configuration,
does not fall back to the local gateway after a failure.

Place the supplied QA and metrics files at their requested paths under the
ignored framework data directories, then run from the Klicker repository:

```bash
pnpm run eval:klicker -- \
  --mode eval \
  --qa-file evaluation/framework/data/output/qa_pairs/qa_pairs_fineco_chatbot_clean.json \
  --metrics evaluation/framework/data/input/metrics/klicker_chatbot.yaml \
  --eval-mode self-assessment \
  --limit 1
```

No `LITELLM_*` exports or `PIPELINES_LITELLM_API_KEY` are needed for this local
path. The QA and metric files are supplied separately; they are not generated
or replaced by the launcher. Keep QA data and result files uncommitted.

### Remote judge through Infisical

Use Python 3.12 and uv. The launcher uses the standard Infisical CLI for human
developer runs. The host validation for the supported CLI was performed with
Infisical 0.43.129. The launcher accepts 0.43.x and rejects other versions before lookup. The CLI help confirms the explicit
--domain, --projectId, --env, --path, --plain, --silent, and --expand flags
used by the launcher. Log in once on the host with:

```bash
infisical login --domain "https://<approved-infisical-host>"
```

Only custom remote judges need the ignored evaluation/config.local.json.
Do not copy the example for the local Docker workflow; its placeholders are not
usable configuration. Judge scope metadata belongs in that optional file.
Start from the committed values-free [configuration example](config.example.json), then fill
the approved scope and secret names through the team's private channel.

KLICKER_EVAL_CONFIG can select another configuration file; relative paths
resolve from the repository root. The file must contain exactly the schema
in the example file, use schema version 1, an HTTPS domain without embedded credentials, an
absolute secret path, and environment-variable-style secret names. Do not put
secret values or broad Infisical exports in this file.

The launcher resolves judge settings in this order:

1. A nonempty LITELLM_API_BASE or LITELLM_API_KEY supplied by the caller wins
   for that setting.
2. Each missing setting is read from the named secret in the explicit
   Infisical domain, project, environment, and path.
3. Supplying both settings bypasses the configuration file and Infisical.

Target-only modes do not read judge configuration or invoke Infisical. --check
uses the same mode-sensitive prerequisites and validates the configured scope
metadata, but never authenticates to Infisical or fetches secret values; it
reports authenticated access as untested. --env remains the framework's
artifact label; it is not an Infisical environment selector.

## Primary commands

Show local launcher usage without reading the private framework or any
configuration:

```bash
pnpm run eval:klicker -- --help
```

Check prerequisites offline. Select the mode whose inputs you intend to run:

```bash
pnpm run eval:klicker -- --check --mode query --agent-id <target-model>
pnpm run eval:klicker -- --check --mode eval
```

Query an existing OpenAI-compatible target with a synthetic or approved
ground-truth directory. The target requires EVAL_ENDPOINT_URL and EVAL_API_KEY
in the invoking environment:

```bash
pnpm run eval:klicker -- \
  --mode query \
  --gt-dir /absolute/path/to/ground-truth \
  --agent-id <target-model> \
  --limit 1
```

Score an existing QA artifact. This mode needs judge settings from the local
configuration and authenticated Infisical access unless both LITELLM_API_BASE
and LITELLM_API_KEY are supplied explicitly:

```bash
pnpm run eval:klicker -- \
  --mode eval \
  --qa-file /absolute/path/to/qa_pairs.json \
  --limit 1
```

Collect target answers and then score them in one run:

```bash
pnpm run eval:klicker -- \
  --mode query-eval \
  --gt-dir /absolute/path/to/ground-truth \
  --agent-id <target-model> \
  --limit 1
```

The remote developer path uses the local scope file and one host login; it does
not require routine export commands. Automated agent runs use the existing
restricted rs-infisical-operator allowlist for approved values. Do not place
credentials in prompts, arguments, logs, or committed files, and do not invent
a new secret mapping when the approved scope is unavailable.

Query output is written under EVAL_OUTPUT_DIR (the framework default is
evaluation/framework/data/output): QA JSON files live in qa_pairs/, and
last_output_file_name.txt points to the latest artifact. Keep generated QA,
evaluation output, and receipts outside the repository when they contain
anything other than synthetic data.

## Portable integration check

After the private framework is initialized and its frozen environment is
available, run the standard-library integration harness with no model or judge
call:

```bash
UV_OFFLINE=true uv run --frozen --offline \
  --project evaluation/framework \
  python util/test-klicker-eval-integration.py
```

The harness requires the framework gitlink at revision
e545dfcfa9979eddeae22197fd7c0f0b053049df.

The harness invokes the real launcher from outside the repository, uses one
temporary synthetic ground-truth case and output directory (including paths
with spaces), and serves one loopback Chat Completions response. A temporary
sitecustomize guard rejects and records DNS or socket access outside numeric
loopback addresses. The test also installs a failing Infisical stub, disables
DeepEval telemetry, scrubs inherited environment variables, sets UV_OFFLINE=true,
uses a five-second query timeout, verifies one target request and a nonempty
actual_answer, then checks temporary-state cleanup.

This is application-level network guarding for a deterministic local test. The
one-time uv sync --frozen step may need package access; the integration test
itself does not authorize package installation or external model traffic.

## Advanced local target

--local-target remains an advanced path for querying a short-lived loopback
adapter that drives a running Klicker Chat route. It is useful for transport,
authentication, persistence, and tool-canary checks; it is not a substitute for
FineCo quality evidence. It requires the exact worktree runtime, namespaced
local API and Chat origins, seeded participant credentials, and the approved
target environment. Do not start an application stack as part of the portable
integration check.

The launcher preflights `KLICKER_EVAL_BUDGET_FILE`,
`KLICKER_EVAL_QUALIFICATION_FILE`, `KLICKER_EVAL_GUARD_ORIGIN`, and
`KLICKER_EVAL_GUARD_KEY`. Prepare these with the guarded workflow above and
start its qualified guard separately; the adapter verifies its live status
before starting. `--check` checks only offline prerequisites. The adapter and
framework target label share `KLICKER_EVAL_MODEL_ID` (default `gpt-6-luna`);
judge model and capability settings remain independent.
An explicitly set origin or generation activates guarded startup checks, even
when empty. After stopping evaluation, unset all five guarded settings to return
to ordinary development: `KLICKER_EVAL_GUARD_ORIGIN`, `OPENAI_BASE_URL`,
`OPENAI_API_KEY`, `CHAT_MODEL_REGISTRY_JSON` and `KLICKER_EVAL_GUARD_GENERATION`.
Clearing only the markers can leave the evaluation key and registry in the
environment because the canonical file does not define their replacements.
Blank markers are incomplete configuration.

The adapter resolves the exact question and mode from FineCo frontmatter and
returns the completed persisted answer as an OpenAI Chat Completions target.
The committed `evaluation/data/canaries/klicker_local_mcp.json` canary proves
transport, authentication, persistence, and mode handling only; it is not
FineCo quality evidence. Keep the FineCo run parked unless the expected
`EXPERT_df_fineco_expert` binding is reachable through an authorized synthetic
environment with a finite response bound.

For a human developer, use the standard Infisical CLI and a narrow approved
scope. Automated agent execution must use the existing restricted
rs-infisical-operator path. Both paths keep values in the child process and out
of source, prompts, and logs. After a local-target run, stop the exact worktree
with devrouter stop /absolute/path/to/klicker-uzh/trees/WORKSPACE and verify
that the provider is stopped and no route remains.

The existing routing and safety modes still pass EVAL_API_KEY to the framework
through --api-key arguments. That is a known framework limitation; this
launcher change does not claim a package-wide no-secret-in-argv guarantee.
Fixing it requires a separately scoped framework change.

## Troubleshooting and acceptance boundaries

- If the framework is missing, run git submodule update --init --checkout
  evaluation/framework and then uv sync --frozen --project
  evaluation/framework.
- If configuration validation fails, replace placeholders with approved
  metadata only. The launcher does not apply implicit project, environment,
  path, provider, or key fallbacks.
- If --check passes, credentials and model access are still untested. A real
  Infisical lookup requires a host login and the approved scope.
- Keep live model runs separate from the portable check. They need an agreed
  target, finite response bound, and cost limit.

The clean local integration check establishes software behavior on this machine.
Second-machine onboarding, native human Infisical lookup, and any paid judge
smoke remain pending acceptance until a collaborator verifies them with an
approved scope and synthetic or explicitly authorized data.

## eLearning-origin cases

eLearning-origin cases extend the same target. Set
`KLICKER_EVAL_ELEARNING_HANDOFF_SECRET` to the shared eLearning handoff secret
of the local stack; the target then requires it as soon as any
`source: elearning` case is present, signs the short-lived handoff grant,
launches `/auth/elearning`, and tags the thread `origin: elearning` so the chat
route answers from the persisted page snapshot. The elearning fixture fields
carry learner and course binding identity only; questions and judged criteria
live in the fixture body as with FineCo. Point `--gt-dir` at a run directory
filled from `data/ground_truth/elearning_examples/`; that directory documents
the four grounding archetypes and the values to replace. Never point a run at
the template directory itself: the placeholders are not a runnable case.

## Graph retrieval comparison

Choose the profile from the reviewed case class before observing retrieval:

- `data/metrics/klicker_graph_answerable.yaml` scores factual correctness at 0.5,
  even with empty retrieval. Precision, recall and faithfulness diagnose evidence.
- `data/metrics/klicker_graph_abstention.yaml` scores explicit source-limited
  abstention at 0.8, including empty or irrelevant retrieval. It rejects invented
  requested answers and fabricated attribution; citation wording is not required.
  Do not calculate contextual recall against an absence-of-evidence reference.
- `data/metrics/klicker_graph_retrieval.yaml` is the supplementary grounded-answer
  profile for answerable cases. Its semantic metric can accept additional details
  supported by the captured passages. It is skipped without context, so it must
  accompany the answerable profile rather than replacing correctness scoring.

Factual references contain only the essential supported answer, or the reviewed
source limitation for unsupported cases. Keep citation requirements, safety rules
and judge instructions in metric criteria. A source-backed numerical example is
not a missing fact merely because the reference omits it. Version prospective
reference copies; retain original scored references and results unchanged.

The current framework keeps native DeepEval case `success` as its aggregate
verdict. Retrieval diagnostics use `flaky: true` so DeepEval reports them without
letting them decide answer quality. Report individual outcomes and denominators.
Missing-context diagnostics are skipped, not passed; count them alongside target
failures and judge errors.

The local Chat Completions transport omits tool results. Capture actual persisted
KB document passages during **query** mode, enrich the resulting QA file, then
run **eval** mode. `query-eval` would judge before enrichment and is unsuitable
for this comparison. Neither the target nor capture receives expected answers.

Use an approved corpus/model route and a separate private directory for each
arm. Set `KLICKER_EVAL_MODEL_ID=gpt-5.6-luna` for the paired quality comparison;
`auto` is supported for a separate routing/operational run. The target currently
requests Luna at low reasoning effort; the judge's `EVAL_REASONING_EFFORT`
does not change the target effort. Auto normalizes its target effort separately.
Use the repository's restricted host-side secret operator for live injection,
with only the approved names; no raw secret fetch or dotenv copy is needed.

The target accepts only loopback origins. To run against a remote deployment,
set `KLICKER_EVAL_ALLOWED_ORIGINS` to a comma-separated list of exact `https`
origins (no path); an origin is accepted only if it matches an entry exactly.
`KLICKER_EVAL_CHATBOT_ID` selects the chatbot instead of the built-in default.

After setting the local participant/origin variables and approved judge route
as above, run inside the existing task container with paths visible there:

```bash
umask 077
export KLICKER_EVAL_RUN_ID=graph-current-luna-pilot
export KLICKER_EVAL_MODEL_ID=gpt-5.6-luna
export KLICKER_EVAL_EVIDENCE_DIR=/tmp/graph-current-luna-pilot
mkdir -m 700 "$KLICKER_EVAL_EVIDENCE_DIR"
pnpm run eval:klicker -- --local-target --mode query --limit 3

node evaluation/scripts/enrich-chat-qa.mjs \
  --qa-file /absolute/path/to/framework-qa.json \
  --evidence-dir "$KLICKER_EVAL_EVIDENCE_DIR" \
  --output /absolute/private/path/enriched-qa.json \
  --run-id "$KLICKER_EVAL_RUN_ID" --model "$KLICKER_EVAL_MODEL_ID"

pnpm run eval:klicker -- --mode eval \
  --qa-file /absolute/private/path/enriched-qa.json \
  --metrics evaluation/data/metrics/klicker_graph_answerable.yaml \
  --eval-mode ground-truth
```

This command does not select the graph policy or create a valid corpus. Verify
the lecturer retrieval toggle and actual corpus/build separately for each arm.
The seeded keyword MCP fixture and marker canary prove integration only; they
cannot support course-quality conclusions or substitute for the FineCo corpus.
The wrapper's legacy default key lookup is not the approved secret setup path;
supply a scoped caller key through the restricted operator. Stop before paid
calls when that route or corpus permission is unavailable.

Evidence captures are exclusive private files bound to completion ID, run ID,
model, mode and question/answer hashes. Only recognized document passages are
exported; unknown, failed, malformed, mixed or oversized results become
incomplete. Empty document results and absent calls have distinct receipts.
Enrichment rejects mismatches and overwrites. Preserve passage order and
repetition: the evaluator must see what generation saw. Obvious credential and
private-URL filtering is an additional guard, not a guarantee that passage text
is non-sensitive. Keep QA, captures and evaluation outputs outside this public
repository and within the approved model-provider data boundary.

For quality, freeze cases by concept/evidence family before tuning; keep
translations/paraphrases in the same split. Compare ordinary RAG and graph
expansion under one model, prompt, mode, context budget and corpus. Add a
non-graph second-search control if the provider exposes it. Otherwise retain
retrieval-spend and context-size confounds in the report. Persisted tool names
do not prove internal expansion counts. Use the server's content-free `[chat.graph_retrieval]` event to distinguish an attempted second search from successful compatible fusion. Check captured passage locators/support separately: fusion does not prove useful new evidence. A null count is unavailable, not an empty result or a pass.

Successful fusion applies 12 passages/16,000 content characters, while baseline and fallback preserve the provider payload. Verify actual context sizes for every arm; do not infer matched budgets from the wrapper. Keep budget enforcement in the provider or evaluation harness rather than changing production retrieval only for tests. A three-question off/on run proves mechanism only; quality qualification needs a fresh frozen family-separated set and predeclared acceptance criteria.

### Prepare matched inputs before generation

`evaluation/scripts/prepare-graph-comparison.py` provides offline data preparation
and an importable generation seam. Use the framework Python environment
with its existing `tiktoken` dependency and cached `o200k_base` encoding. A missing
or invalid tokenizer cache stops preparation without downloading anything.

```bash
python evaluation/scripts/prepare-graph-comparison.py \
  --input /absolute/private/path/retrieval-arms.json \
  --output /absolute/private/path/prepared-inputs.json
```

The input has one `cases` list. Each case contains only `id`, `question` and `arms`.
The three arm names are `ordinary-rag`, `document-second-search` and
`falkordb-graphrag`; each maps to an ordered list of passage strings. Include
source labels and locators inside those strings. QA files and expected answers
are rejected, so preparation cannot quietly shorten evidence after generation.

The canonical user input is compact JSON with `question` and `retrieval_context`.
The 4,096-token cap includes that complete rendered user input, its delimiters and
question overhead. Per case, the shortest available input sets the common quota
(up to the cap). All three inputs must fall between quota minus eight and quota.
Only literal Unicode prefixes are retained, with no padding or reordering.
All-empty arms are valid; mixed empty/nonempty arms stop as unmatched retrieval
failures. Report these failures separately rather than dropping them from quality
denominators. Preparation records original and selected sizes, tokenizer version,
source hash and exact input text, and refuses to overwrite an earlier file.

Future generation must use each saved `rendered_input` unchanged, with the same
system prompt, target model, effort and output cap across arms. Chat protocol
framing and provider-billed token counts require separate verification. This
preparation does not prove a matched native chatbot run. The existing capture
adapter records what the chatbot actually saw; it must never clip persisted
context after generation to manufacture budget matching.

The importable `generate_matched(prepared, contract, client, encoding)` validates
every saved arm before dispatch. The contract contains `model`, `system_prompt`,
`reasoning_effort` and reasoning-inclusive `max_completion_tokens`. It uses the
caller's already-admitted OpenAI-compatible client, disables SDK retries and
yields standard QA records one at a time. Persist each before advancing. A failed
or incomplete response stops the sequence. This helper creates no provider client
and exposes no paid CLI. The caller still owns cost admission, gateway retries,
fallbacks, pricing and durable failure receipts. There is no live-provider
qualification in the offline contract tests.

QA keeps the original common question and the actual arm passages in
`retrieval_context`; `source_metadata` records exact rendered input, hashes,
request settings and response usage. Only after generation, `attach_references`
joins native DeepEval `Golden` objects by `additional_metadata.case_id`, checking
the common question. These records enter the existing framework loader and
DeepEval metrics. The loopback fake-provider contract is runnable without
credentials or any external model request:

```bash
DEEPEVAL_TELEMETRY_OPT_OUT=YES evaluation/framework/.venv/bin/python \
  -m unittest discover -s evaluation/tests -p 'test_matched_generation.py' -v
```

A larger comparison should freeze source versions and concept/evidence families
before tuning, keeping paraphrases in one split. The proposed next pilot contains
16 answerable and eight unsupported held-out cases across all three arms (72
answers). Keep development seeds separate. Before paid execution, require a
reviewed private holdout freeze, matching target KB/graph source versions and
separate spend approval. Local source custody alone does not qualify a live
retrieval corpus. Generate candidates with DeepEval's existing synthesis path only
after its source and cost approval, or curate existing source-grounded cases.
Review factual references and absence claims before freeze. Keep teaching data and
receipts in a private ignored directory; committed examples and tests use synthetic
data only.

Record actual context sizes, per-case
metric outcomes and skips, errors, latency and spend. The existing quality
reports/dashboard consume evaluator output; `compare_runs` is for load metrics.
No additional evaluation engine is needed.

Offline regression checks use only test-owned synthetic payloads:

```bash
pnpm --filter @klicker-uzh/chat exec vitest run test/klicker-evaluation-target.test.mjs
node --test evaluation/tests/enrich-chat-qa.test.mjs
bash util/test-klicker-eval-wrapper.sh
# Use the initialized framework's pinned Python environment:
python evaluation/tests/test_graph_metric_contract.py
python evaluation/tests/test_prepare_graph_comparison.py
```

The Python check uses the real framework loader, metric factory and runner with
substituted judges. It proves passage consumption and skipped-case accounting;
its fabricated metric outcomes are not quality scores. No paid model call or
Confident AI upload is required. Run container-dependent checks through
`devrouter exec <exact-checkout> -- <command>`; this task's existing runtime may
remain available for the explicitly requested local testing lease.
