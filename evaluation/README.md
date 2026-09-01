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

The root wrapper uses the restricted `klicker-uzh-stg` Infisical operator
profile. It maps only the approved LiteLLM credential, selects Klicker's
namespaced Azure deployment, and points the framework at the FineCo ground
truth and tool catalogue. Caller-provided model and framework settings win over
these defaults. Changing only `EVAL_MODEL` leaves the Luna capability mapping
unset, so a different model uses its own metadata; set both variables when a
different deployment alias needs explicit capability metadata. Set
`LITELLM_API_BASE` to an approved reachable proxy route; the public repository
does not store an internal hostname. The operator fails when the mapped secret
is missing, and the wrapper rejects an empty `LITELLM_API_KEY` before starting
the evaluator. The wrapper also checks that the selected metrics and tool files
and both ground-truth directories are readable before secret retrieval.

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
namespaced *.localhost origins, and the wrapper removes its listener on success
or failure.

Start the exact worktree runtime with the developer Foundry values injected
only through the restricted operator. The VPN must be active, and an existing
runtime must be stopped and restarted when it was started without this
injection:

    rs-infisical-operator --profile klicker-dev run \
      --map AZURE_OPENAI_API_KEY=UPSTREAM_OPENAI_API_KEY \
      --map AZURE_OPENAI_BASE_URL=UPSTREAM_OPENAI_BASE_URL -- \
      devrouter ensure /absolute/path/to/klicker-uzh/trees/WORKSPACE \
      --profile chat,ai,mcp --json

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
