# Portable Klicker evaluation setup

## Approval summary

Make evaluation runs reproducible for collaborators without manual LiteLLM exports. The launcher will load only the configuration required by the selected mode, obtain the judge URL and key together from an explicit Infisical scope, and explain missing prerequisites before starting work.

Keep the existing pnpm entrypoint, framework revision, judge model, datasets, metrics, and environment overrides. Use the standard Infisical CLI for human developer runs; do not make another machine depend on the author's private operator installation. Agent-run real secret access continues through the restricted operator. The new lookup passes only needed values to each child. Existing routing and safety modes pass their target key to Python through process arguments; that separate framework limitation is disclosed and unchanged.

The exact judge secret mapping needs confirmation from values-free configuration evidence. Do not presume PIPELINES_LITELLM_API_KEY is appropriate, substitute a master key, or silently change provider or environment. Configuration stays outside public source when it contains internal endpoints. No secret-store or permission changes are included.

Success means mode-sensitive regression tests and the real pinned runner pass against a synthetic loopback target in a clean environment, plus a reproducible setup guide. Real Infisical and second-machine acceptance remain explicitly separate evidence if access is unavailable. Live model runs need a separately agreed target and cost bound.

Approval authorizes the source changes, focused checks, required reviews, local commits, ordinary task-branch push, and one draft PR targeting enhance-ground-truth. It also authorizes disposable synthetic loopback test processes and frozen evaluation dependency preparation from the existing lockfile. It does not authorize merges, deployments, secret writes, permission changes, application-stack or live-service startup, or paid model calls.

## Execution details

### Evidence and working context

- Repository: uzh-bf/klicker-uzh. Worktree: trees/rs/eval-portability. Branch: rs/eval-portability, based on origin/enhance-ground-truth at 98fef1fef8c4147b7884c336c592e3e16c12e43e. The requested branch is the proposed PR base; no open PR was found for that branch. Revalidate the base before implementation and ask if the intended delivery target changes.
- The primary checkout is v3 tracking origin/v3, zero ahead and 37 behind the remote default when fetched during this investigation. It contains unrelated changes. Preserve those and all existing evaluation worktrees.
- The public wrapper at util/_run_klicker_eval.sh hardcodes the staging project/key lookup, requires LITELLM_API_BASE at lines 60–63, and resolves the key unconditionally at line 129. It invokes the framework with --no-dotenv. evaluation/README.md documents the manual export.
- Framework gitlink: 2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b. Immutable source examined in the existing local evaluation repository. scripts/_run_eval.sh defaults to query; supports space-separated flags; --mode=query and --help are currently errors. Only eval and query-eval invoke DeepEval. Query uses EVAL_ENDPOINT_URL and EVAL_API_KEY. Python is pinned to 3.12.* and uv.lock exists.
- util/test-klicker-eval-wrapper.sh mocks Infisical and uv. The framework already has loopback query-client coverage in tests/test_client_integration.py. Reuse its approach for a single launcher-to-artifact integration test.

No product primitive changes: this extends the developer launcher contract, preserving evaluation meaning. No ADR is needed for the reversible launcher repair; revisit only if implementation requires a new credential authority, provider, or shared framework architecture. Full-path package because credential handling and the public command contract change. One cohesive PR, no stack or framework MR planned.

### Command and configuration contract

| Invocation | Required configuration | Effect |
| --- | --- | --- |
| --help | None | Local usage, exit zero; no submodule, secret lookup, uv or network |
| --check with a selected mode | Local prerequisites and configuration names | Offline diagnostics; no secrets, install, target/model calls |
| query, routing, safety, loadtest | Target endpoint/key and mode-specific inputs | Preserve existing target behavior; never resolve judge secrets |
| eval | Judge URL/key and QA input | Score existing QA; do not require target access |
| query-eval | Both sets | Collect then score; validate both sets before starting |

Preserve the default mode query. Implement only the parser needed to determine mode and wrapper flags; retain runner argument ordering and grammar. Reject invalid or missing mode arguments locally before fetching secrets. Normalize --mode=value if added, document it and test it; do not forward syntax unsupported by the framework. Keep --env as the framework's run label, not an Infisical environment selector. Forbid --local-target with eval before starting an adapter because eval consumes an existing artifact.

Add --check to the existing launcher instead of a separate doctor framework. Report tools, framework initialization and pinned revision, selected mode, required variable names, scope completeness and next actions. Report authenticated access as untested; offline success must not claim credentials work. Normal runs execute local argument/input prerequisites before any credential lookup. Avoid requiring judge-only files for target-only modes.

Resolve judge settings by explicit environment values first, then missing values from the configured Infisical scope. Do not look up anything when both judge values are supplied. No fallback to a different domain, project, environment, provider, key class, or broader secret path on failure.

Use evaluation/config.local.json (gitignored) and a committed evaluation/config.example.json with placeholder metadata. The schema is:
```json
{
  "schemaVersion": 1,
  "infisical": {
    "domain": "https://<approved-infisical-host>",
    "projectId": "<project-id>",
    "environment": "<environment>",
    "path": "<secret-path>"
  },
  "judge": {
    "baseUrlSecret": "<judge-url-secret-name>",
    "apiKeySecret": "<judge-key-secret-name>"
  }
}
```
KLICKER_EVAL_CONFIG optionally selects another file; relative paths resolve from the repository root. Those are the only new configuration controls. LITELLM_API_BASE and LITELLM_API_KEY remain independent nonempty overrides; empty values count as missing. Judge modes load the file only when a required judge value is missing. Complete explicit credentials bypass even a missing or malformed file and never invoke Infisical. Target-only modes and help do not read judge configuration. --check follows the selected mode's same resolution rules without fetching values.

When the file is needed, require all listed fields, schema version 1, nonempty strings, a valid HTTPS domain without embedded credentials, an absolute secret path, and valid environment-variable-style secret names; reject unknown fields. No implicit scope defaults or ambient Infisical environment selection. Malformed/incomplete configuration fails before lookup. The example remains values-free; actual endpoints, scope and source mapping are supplied once through the team's approved private channel. Do not change shared .infisical.json behavior or put keys in JSON. Parse with existing Node tooling without new dependencies or shell evaluation.

The normal developer command remains pnpm run eval:klicker -- --mode eval --qa-file PATH. One-time setup supplies the Infisical scope file and login, followed by --check. An operator already supplying both judge variables bypasses the native lookup; live agent execution must use rs-infisical-operator under its existing read allowlist.

Fetch only the named missing values via the standard CLI into process memory, using explicit domain/project/environment/path. Validate CLI support against the documented supported version; fail clearly rather than guessing alternate flags. Do not bulk-inject a staging scope. For the new launcher/judge lookup, keep raw values out of arguments, logs, files, exceptions and diagnostics. Capture CLI failure output privately in process memory or discard it; emit a sanitized error category and remediation, never raw stderr. Preserve nonzero failure and downstream exit status; no silent empty defaults. The unchanged framework's routing and safety commands currently put EVAL_API_KEY in --api-key arguments; fixing that requires a separately scoped framework change. Do not advertise a package-wide no-argv-secret guarantee. Preserve judge/target credential separation, including removal of legacy source aliases and configured source-name aliases after mapping. Retain a canonical destination variable only in the child that needs it; a source name identical to that destination must not erase the required mapped value. Track names, not values, for environment removal; test dynamically configured aliases and source/destination name collisions. Do not repurpose PIPELINES_LITELLM_API_KEY without confirming intended access. A mapping may retain that source name if evidence establishes it is the approved judge key.

### Delegation Map and sequence

| Workstream | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Mode handling and offline checks | executor | Approved plan | Existing shell suite extended for mode and validation behavior |
| Infisical mapping and isolation | main | First workstream; verified scope contract | Synthetic CLI contract tests and subprocess environment assertions |
| Portable integration and guide | executor | Integrated launcher | Real pinned runner loopback artifact and clean-environment setup checks |

The main session owns decisions, integration, credential boundaries and final evidence. The secret integration stays main-owned because of its security decision boundary. Delegate each executor workstream with finite files and acceptance commands; use serial ownership for overlapping wrapper/tests.

First slice: modify util/_run_klicker_eval.sh and its existing test suite. Prove query succeeds with judge variables absent and the Infisical executable unavailable; help works without submodule; invalid inputs stop before effects; check never performs network or execution. Commit with fix(evaluation) after focused checks.

Second slice: add the minimal configuration loader only if needed for safe JSON parsing; add the ignored local configuration path and a values-free example. Update the wrapper and tests for URL/key sourcing, explicit overrides, missing/empty/failed lookups, explicit scope selection, and credential isolation. Preserve existing model/metrics behavior. Commit with fix(evaluation).

Third slice: add util/test-klicker-eval-integration.py, a standard-library harness with one real framework query run against loopback and one temporary synthetic GT fixture. Update evaluation/README.md to put first-time setup and the three primary modes first, including private submodule access, Python/uv prerequisites, outputs, and troubleshooting. Keep local application-target startup as an advanced existing path. Commit with test(evaluation) or fix(evaluation) as appropriate.

### Verification and portability

Run bash -n util/_run_klicker_eval.sh and bash util/test-klicker-eval-wrapper.sh on supported macOS Bash and Linux. Extend existing tests rather than pinning error prose. Assert outcomes, effect counts, argv contracts, exit status, missing credentials and child environment boundaries with synthetic values. Replace the existing assertion requiring raw Infisical stderr with a regression that injects a credential sentinel into CLI stderr and proves it never appears in launcher stdout/stderr. Test configured alias stripping and malformed-file bypass with complete overrides.

Prepare the pinned private submodule explicitly using the documented git submodule update command; use existing GitLab access and stop if unavailable. Run uv sync --frozen --project evaluation/framework once for dependency preparation. Run the host-side evaluation test with UV_OFFLINE=true uv run --frozen --offline --project evaluation/framework python util/test-klicker-eval-integration.py. Add --frozen to the launcher's existing uv run call to enforce the pinned lock. The evaluation workflow already invokes host uv; this does not authorize host builds or tests for container-owned application packages.

The integration harness invokes the actual Klicker wrapper and pinned runner with no inherited VIRTUAL_ENV, judge secrets, dotenv, or user config. Install a temporary test-only Python sitecustomize guard via the subprocess PYTHONPATH to reject DNS lookups and socket connections except explicit loopback addresses. Fail the test on any rejected attempt; set UV_OFFLINE=true to prevent dependency resolution during the run, and use a failing Infisical stub to detect accidental lookup. This is an application-level test guard, not an OS network sandbox. Assert its rejection behavior before the integration run. Use a temporary output directory outside the repo, a synthetic loopback endpoint and a five-second query timeout. Prove actual_answer is present, exactly one expected target request occurs, and no judge or Infisical call occurs. Local dependency installation may contact package registries; the test itself allows loopback only. Do not update uv.lock or the gitlink.

Test ordinary clone and linked-worktree path resolution, including paths containing spaces and invocation outside the repo. Check missing submodule and unsupported/missing tools produce actionable failures. Private submodule access prevents requiring public CI to fetch it: keep fast wrapper tests public-CI-compatible and report framework integration separately. Record exact commands, tool versions, framework SHA and evidence type.

Real-machine acceptance has two levels. Clean-environment local integration establishes reproducible software behavior. A collaborator following the guide on another machine establishes onboarding; until received, label it unverified rather than complete. A values-free real Infisical injection check may run only through an existing approved operator profile; missing setup or mappings become a concrete administrator handoff, never automatic permission changes. Human native-CLI acceptance and any paid one-case judge smoke remain separate pending checks, with target and cost scope to be agreed.

Run repository-native applicable formatting/checks before commits. Container-required toolchain checks follow repo policy; if they require starting a runtime, report the gap and request that separately rather than claiming a pass. Do not start an app stack for shell/config verification.

### Reviews and delivery

Planner approval is required before presenting this plan. For substantive committed slices run the configured simplifier; the credential slice also requires one risk-selected reviewer covering secret handling and process boundaries. Review private configuration only on trusted routes; external reviewers receive public source and synthetic fixtures only. After integration and required verification, use one final reviewer for correctness, security, maintainability and plan compliance. Verify and disposition findings before draft publication. Do not call a pending live acceptance check completed.

Authority: the user approved this plan on 2026-09-08. Execute source implementation, focused verification, reviews and routine draft delivery through the terminal condition.
Terminal: reviewed source package, applicable checks, one draft PR against enhance-ground-truth, and an explicit list of any unverified real-Infisical or second-machine acceptance.
Boundary owner: self.
Pause: wrong or ambiguous secret mapping, new permission or infrastructure requirement, required tool unavailable after allowed fallback, material framework change, or changed provider/data/cost boundary. Finish independent source work before pausing for live acceptance.

## Progress

User approval received on 2026-09-08. All three source slices are implemented. The launcher now resolves prerequisites by mode, reads missing judge settings from explicit Infisical scope metadata, and preserves relative input paths across the framework launch. The final portability checks also found and fixed empty-array handling on macOS Bash 3.2. The framework gitlink and lockfile remain unchanged.

Native planner review: round 1 REVISE; all four findings accepted; round 2 APPROVED. Three simplifier passes completed; accepted reductions remove duplicated path validation, an always-true condition, and duplicated configuration documentation. Integrated final review passes at 4952590e06 after corrections to lookup credential isolation, offline model prerequisites and semantic argument validation. The reviewer accepts retaining the pinned framework's closed option grammar to reject invalid input before lookup. Credential-slice review remains pending before publication. Optional external plan review was excluded because the draft was unpublished.

Passing evidence on 2026-09-08: wrapper tests under macOS Bash 3.2 and Linux Node 24.16.0 in a disposable container with external networking disabled; Node configuration tests in the same Linux image; shell syntax and ShellCheck warning checks; Biome, Prettier, Ruff and Git whitespace checks; ordinary-clone help and missing-submodule behavior with spaces in the checkout path; and the real pinned framework integration producing exactly one loopback QA artifact. The integration uses Python 3.12.13 and uv 0.12.10, an empty temporary user environment, relative input paths, and a test-only network guard. Its final run used a writable temporary uv cache and offline frozen dependencies.

Live acceptance remains pending: the existing approved operator profile has no judge URL/key mapping, so no real secret lookup or paid judge call was performed. A collaborator must confirm the approved scope metadata and follow the guide on another machine. No secret permissions were changed. No application stack was started. Broad monorepo build/typecheck and container-owned application hooks were not run; the worktree has no installed Husky hook directory. Focused checks and staged secret/identity checks were run directly. Draft delivery remains the next action after required reviews pass; merging and live operations are outside this approval.
