# Evaluation

AI-quality evaluation assets for KlickerUZH.

- `framework/` — git submodule pointing at the UZH-internal
  [`ai-infrastructure/evaluation`](https://gitlab.uzh.ch/ai-infrastructure/evaluation)
  harness (transport-neutral DeepEval runner). The repository is **private to
  UZH**: the submodule is declared with `update = none`, so regular clones —
  including `git clone --recursive` — skip it and nothing in the build, dev
  stack, or CI depends on it being present.
- `data/` — committed evaluation datasets (e.g. ground-truth QA cases under
  `data/ground_truth/`). Synthetic examples only; no production or personal
  data.

UZH-internal users with GitLab access can materialize the framework explicitly:

```bash
git submodule update --init --checkout evaluation/framework
```

The root wrapper reads `LITELLM_API_BASE` and `LITELLM_API_KEY` from its
invoking environment. It does not depend on a specific secret manager or local
operator. The wrapper selects Klicker's namespaced Azure deployment and points
the framework at the FineCo ground truth and tool catalogue. Caller-provided
model and framework settings win over these defaults. Changing only
`EVAL_MODEL` leaves the Luna capability mapping unset, so a different model
uses its own metadata; set both variables when a different deployment alias
needs explicit capability metadata. Set `LITELLM_API_BASE` to an approved
reachable proxy route; the public repository does not store an internal
hostname. The wrapper rejects a missing key before starting the evaluator and
checks that the selected metrics, tool file, and ground-truth directories are
readable.

Inject the two judge variables with the team's approved secret manager or as
masked CI variables. For example, the native Infisical CLI can map the stored
judge key in a short-lived child process without writing a dotenv file:

```bash
export LITELLM_API_BASE="https://<approved-litellm-route>"

infisical run \
  --domain="https://<infisical-host>" \
  --projectId="<project-id>" \
  --env="<environment>" \
  --path="<secret-path>" -- \
  sh -c '
    export LITELLM_API_KEY="${PIPELINES_LITELLM_API_KEY:?missing judge key}"
    exec pnpm run eval:klicker -- "$@"
  ' klicker-eval \
  --mode eval \
  --qa-file /absolute/path/to/synthetic-qa.json \
  --limit 1
```

Use a read-only scope containing only the required evaluation secret where
possible. Never print the key or place it in a command argument, dotenv file,
or committed artifact.

On GitLab, configure `LITELLM_API_BASE` and `LITELLM_API_KEY` as masked CI/CD
variables and invoke `pnpm run eval:klicker` directly. The job does not need
Infisical or `rs-infisical-operator` when those variables are already present.

Eval mode judges an existing synthetic QA artifact; it does not query Klicker:

```bash
pnpm run eval:klicker -- --mode eval --qa-file /path/to/synthetic-qa.json --limit 1
```

## Local Klicker target

The explicit --local-target mode starts a short-lived loopback adapter that
drives the authenticated Klicker Chat route and presents its completed
persisted answer as an OpenAI Chat Completions target. The adapter resolves only
the exact question and mode from FineCo frontmatter; expected answers remain
inside the evaluator. Participant credentials are read from the invoking
environment and are removed from the evaluator child. The adapter accepts only
namespaced \*.localhost origins, and the wrapper removes its listener on success
or failure.

Start the exact worktree runtime with the developer Foundry values mapped to
the generic local LiteLLM variables. The VPN must be active, and an existing
runtime must be stopped and restarted when it was started without this
injection. This native Infisical example keeps the mapping inside its child
process; substitute the approved secret store when Infisical is not used:

```bash
infisical run \
  --domain="https://<infisical-host>" \
  --projectId="<project-id>" \
  --env="<environment>" \
  --path="<secret-path>" -- \
  sh -c '
    export UPSTREAM_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY:?missing target key}"
    export UPSTREAM_OPENAI_BASE_URL="${AZURE_OPENAI_BASE_URL:?missing target URL}"
    exec devrouter ensure "$1" --profile chat,ai,mcp --json
  ' klicker-runtime \
  /absolute/path/to/klicker-uzh/trees/WORKSPACE
```

`infisical run` exposes every readable secret in the selected path to its child
process. Use a dedicated read-only developer scope containing only the required
target values where possible; do not point this launcher at a broad production
scope.

Set the namespaced API and Chat origins plus local seeded participant
credentials in the shell, and set LITELLM_API_BASE to the separately approved
judge proxy route. Then run the target query:

    pnpm run eval:klicker -- --local-target --mode query --limit 20

The committed klicker_local_mcp.json canary is transport evidence only. It
proves the seeded KB_doc_query path, authentication, persistence, and mode
handling; it is not FineCo quality evidence. The FineCo run stays parked unless
the expected EXPERT_df_fineco_expert binding is already reachable through an
authorized synthetic environment with a finite response bound. Do not replace
that gate with the local canary or establish a tunnel from this workflow.

After any target or judge run, stop the exact worktree with
devrouter stop /absolute/path/to/klicker-uzh/trees/WORKSPACE and verify the
provider is stopped and no route remains. Keep generated QA, receipts, and
evaluation output outside the repository. Query and query-eval modes require a
separately verified target; the existing judge-only mode remains unchanged.
