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

## One-time setup

The pinned framework is a private submodule. Developers with GitLab access
materialize it explicitly:

```bash
git submodule update --init --checkout evaluation/framework
uv sync --frozen --project evaluation/framework
```

Use Python 3.12 and uv. The launcher uses the standard Infisical CLI for human
developer runs. The host validation for the supported CLI was performed with
Infisical 0.43.129. The launcher accepts 0.43.x and rejects other versions before lookup. The CLI help confirms the explicit
--domain, --projectId, --env, --path, --plain, --silent, and --expand flags
used by the launcher. Log in once on the host with:

```bash
infisical login --domain "https://<approved-infisical-host>"
```

Judge scope metadata belongs in the ignored evaluation/config.local.json.
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
pnpm run eval:klicker -- --check --mode query
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

The normal developer path uses the local scope file and one host login; it does
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
2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b.

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
