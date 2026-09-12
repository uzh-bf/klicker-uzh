# Opt-in AI for retained local KB acceptance

## Approval summary

The user approved restoring scoped registry access, adding an explicit AI
overlay, and completing one public-PDF ingestion and citation test. The local
launcher currently strips upstream credentials, so starting the infrastructure
does not enable embeddings or real retrieval. Add one optional OpenRouter mode
to the existing isolated configuration and supply its credentials only during
authorized host-side launcher execution.

Approval mode: executable batch. This package covers source implementation,
focused checks, independent reviews, normal push and draft PR, and the already
approved local acceptance journey. It does not authorize a new source merge,
production, graph generation, or deletion. Existing test data is retained.

Default configuration stays credential-free. Opt-in startup requires runtime
injection through the restricted Infisical operator. No upstream credential
may enter generated files, receipts, command arguments, or diagnostics.
Only LiteLLM receives it among containers. The trusted host launcher chain and
its initialization hook inherit the runtime environment. Public PDF content and synthetic questions may reach
the approved OpenRouter upstream; this entails ordinary model and embedding
usage. No bulk evaluation or unrelated content is included.

Completion requires reviewed source and successful PDF ingestion, cited
retrieval, and retrieval of the same retained resource after stop/resume and
browser reload. Health checks alone do not establish acceptance.

## Execution details

### Context and evidence

Repository: KlickerUZH. Target: v3-ai at
`d1e1fafadd62be82cb68273659c94ac913ea2e5b`, confirmed through GitHub and a
same-repository HTTPS fetch after the SSH signing agent failed.
Branch: `rs/local-kb-ai-overlay` in `trees/rs/generation-lifecycle-contracts`.
The preceding source branch and pristine detached acceptance checkout remain.
Artifacts remain in `project/`; the plan was committed as `54129eaa28` after
the user approved implementation-worktree startup and its normal hooks passed.

Baseline launcher tests pass 68/68. Both ingestion images from merged provider
revision `3eaee85555a01d45e425c93bb9bf058d4a782e91` were pulled and their
revision labels verified. Scoped registry access now uses the existing macOS
Keychain helper. No real AI key has been injected and no runtime has started.

### Binding contract

- Optional `aiUpstream: 'openrouter'`; omission preserves the existing resolved
  configuration shape. Reject unsupported modes. The existing preparation
  digest binds the non-secret mode, preventing retained configuration changes.
- Accept `UPSTREAM_OPENAI_API_KEY` and `UPSTREAM_OPENAI_BASE_URL` only from
  the host process. Require a nonempty key and the exact OpenRouter HTTPS API
  endpoint before setup/start/resume can claim state or activate providers.
- Compose contains name-only pass-through entries for LiteLLM, without required
  interpolation. Setup excludes LiteLLM and does not forward the key, even
  though preflight requires it; Compose must resolve unselected services without
  credentials. Stop and status likewise resolve without injected credentials. No secret
  interpolation belongs in Devcontainer configuration or workspace arguments.
- Only the managed start call receives the two additional environment names.
  Providers, backing Docker commands, app exec, status, and stop do not.
- Resume requires re-injection. Missing injection never consumes an attempt.
  Stop and status remain available without the upstream credential.

### Delegation map and slices

S1: main owns the coupled credential seam and source integration. Extend `isolated-config.mjs`,
`managed-configuration.mjs`, `docker-preflight.mjs`, `preparation.mjs`, and
`util/local-kb-stack.mjs`, plus their existing relevant tests. No provider,
data-model, dependency, or routing-policy changes are planned. Commit the
reviewed plan before implementation. Run simplification and a risk-selected
review on the committed slice. Integrated final review follows the complete
source package, including S2 documentation and applicable verification.

S2: main owns tightly coupled local runtime acceptance and updates
`docs/solutions/integration/local-kb-stack.md`. After S1 and the synthetic
transport gate pass, create a fresh detached runtime checkout at the reviewed
implementation commit; preserve the existing pristine d1e1faf checkout. Bind
that candidate and the verified provider/image pins in its input and run one
successful canonical setup before start. Start the exact isolated stack
through its canonical launcher, prove worker readiness, submit one public PDF,
and verify READY, retrieval, and a correct original-source citation. Stop and
resume without setup or re-ingestion, then verify the same resource and retained
chat/citation after reload. Preserve failures and stop before any ambiguous
replay, repair, or ownership change. Stop the exact runtime at completion unless
the user explicitly requests it remain running.

### Verification portfolio

Extend `isolated-config.test.mjs` for invalid opt-in, default shape and renderer
confinement. Extend `docker-preflight.test.mjs` for the actual child environment,
secret-free argv and withheld failure diagnostics. Extend `preparation.test.mjs`
for pre-mutation rejection, retained mode binding and re-injected resume.
Extend `util/local-kb-stack.test.mjs` for CLI rejection before its preparation
claim. Reuse existing synthetic fixtures and avoid duplicate coverage across
these primary seams. Test obligation is none for guide wording and the manual
acceptance journey. Run
`node --test util/local-kb/*.test.mjs util/local-kb-stack.test.mjs` and focused
repository formatting checks. Browser and live ingestion evidence remains a
distinct acceptance boundary, not inferred from these tests.

### Transport evidence and verification gate

The selected runtime is Devsy 1.16.2 through Devrouter 0.0.77. Devrouter
inherits and forwards the host environment to Devsy. Devsy's Compose helper
uses the agent's environment; its generated primary-service override does not
copy sibling LiteLLM variables. The local Docker provider's agent inherits the
host environment through its local shell and SSH child (Devsy v1.16.2 commit
232bbfc14a5430799c6ded50736e0707be5f7302). Its
`WorkspaceEnv` path is unacceptable because upstream source documents that it
travels in setup argv. Verify with a synthetic sentinel before real injection.
The checked host initialization hook does not print its environment; it runs
the dependency-mount generator, local certificate copy, and cache-volume check.
Unsupported transport blocks
S1; do not substitute an environment file or credential-bearing argument.

## Progress

- S1 implementation committed at `f3a372f98a63d3eda5d35a00e8b77e0232066ba2`.
  Nine source/test paths; 247 added and 21 removed substantive lines.
  Three tests added and existing configuration/restart tests extended;
  focused suite passes 71/71 in the container. Full normal pre-commit passes.
  Simplifier and GLM slice review passed on the exact committed range; their
  reports are retained under `project/_local/reviews/`.
- S2 guide committed at `5d1fd4b4a30846c9904960c107fd31c21fdabe6a`.
  Package size excluding project artifacts is 305 changed lines. There are no
  schema, dependency, or visible UI changes. Source verification does not prove
  the runtime credential transport or live ingestion path.
- Fresh isolated setup at that candidate failed during document-processing
  Hatchet token creation with `backing_command_failed`. The launcher retained
  `token_intent: true` without a client-token receipt. No replay is authorized;
  preserve the failed attempt. Backing containers were stopped and data retained.
  The underlying command stderr was discarded, so its precise cause is unknown.
- The synthetic transport probe did not reach managed AI startup. No real AI
  key was injected and no PDF submitted. PDF/citation and retained restart proof
  remain blocked on provider setup recovery and successful transport verification.
- Implementation runtime was verified stopped with zero routes, then resumed
  only for normal publication hooks. Stop it again after those checks.
- The initial final-review process ended without a recoverable report. One
  replacement final review is running on the unchanged source range. Draft
  delivery remains pending; no PR URL exists yet. Target freshness confirmed
  `origin/v3-ai@f00e272adf40dd3cbe2c648935cde1d99727af59`; its 11 intervening
  commits do not overlap the changed source, so no integration was necessary.

### Prior preparation evidence

- Registry recovery and immutable image verification complete.
- Baseline source checks pass 68/68; no implementation changes yet.
- Planner James approved hardening round 2. AGY Gemini 3.8 Flash high independently
  returned APPROVED. Implementation and its reviews have not started.
- Normal pre-commit passed gitleaks, then failed: the implementation worktree
  has zero running app containers. No bypass or commit occurred. The 68 passing
  launcher tests do not replace the full container check suite.
- Runtime setup, PDF ingestion, retrieval, and retained restart remain unrun.
