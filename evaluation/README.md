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
these defaults. Set `LITELLM_API_BASE` to an approved reachable proxy route;
the public repository does not store an internal hostname.

Eval mode judges an existing synthetic QA artifact; it does not query Klicker:

```bash
pnpm run eval:klicker -- --mode eval --qa-file /path/to/synthetic-qa.json --limit 1
```

Query and query-eval modes require a separately verified OpenAI Responses or
Chat Completions target. Klicker's current authenticated AI-SDK UI stream is not
that target contract, so the wrapper does not claim a live Klicker target run.
Use only synthetic inputs and do not add local QA or evaluation outputs to the
repository.
