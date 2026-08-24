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

How the framework consumes the datasets in `data/` (ground-truth roots, tool
profiles, metric suites) is still being wired up and documented.
