# Tutor Structural Evals

Deterministic, non-network checks for tutor policy regressions.

Run from the repo root:

```bash
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_tutor_structural.ts
```

The suite covers:

- finance local move policy
- pedagogical safety preflight
- answer leakage verifier
- RAG citation fidelity
- multimodal image uncertainty
- memory privacy gate

Results are written to `project/evals/results/` and ignored by git.
