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

This source introduces the action without migrating an active caller. Existing
draft workflows and individual/stack final controllers retain their behavior.
Native GitLab still needs a qualified trusted controller and publisher for its
selected instance; the Node runtime alone does not establish that support.

## Release identity

`.github/open-code-review/runtime-manifest.json` binds the action, controller,
runner, adapter, tools, context validator, pure helpers, portable skill and
patched installer/patch by SHA-256. The controller verifies the complete asset
inventory with Node built-ins before importing runtime modules. Symlinks,
missing assets and changed bytes are rejected. The action source must be pinned
by its complete Git commit; mutable refs are rejected. The manifest records no
enclosing commit hash, avoiding a self-reference.

The draft profile uses stock npm `@alibaba-group/open-code-review@1.13.0`,
`zai-glm-5-3-flash` through Mistral and the existing bounded `zai-glm-5-3` advisor.
Verification checks the stock version and the immutable upstream publisher's
digest. It does not claim platform-specific stock binary digest verification.
Final execution keeps its separate pinned upstream source, compression patch,
Go toolchain and executable provenance. The shared action does not run final
review or grant its approval.

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

## Prepare a caller upgrade

First publish the action source and verify its producing offline qualification.
After merge, resolve the actual merged source revision with host `gh` and Git.
Pin `OWNER/REPOSITORY/.github/actions/ocr-review@FULL_COMMIT_SHA` in the caller;
do not use a guessed squash hash or a local action path as distribution proof.

The caller keeps one `ocr-review` job with `pull_request_target` draft admission,
read-only contents and review-write permissions, its existing concurrency group,
a 45-minute timeout and `OCR_NO_UPDATE: '1'`. Its only execution step is the pinned
action with these explicit bindings:

```yaml
with:
  mistral-api-key: ${{ secrets.MISTRAL_API_KEY }}
  context7-api-key: ${{ secrets.CONTEXT7_API_KEY }}
  github-token: ${{ github.token }}
```

Do not expose these credentials through job-level environment variables.
Repository-specific activation can narrow the normal draft expression and must
be supplied explicitly to the shared caller checker. The checker never enables
that activation. Caller migration also updates its portable skill and trusted
context configuration, then removes obsolete controller copies only after shared
behavioral contracts replace them.

For an offline check, parse YAML with the repository's installed parser and pass
the resulting JSON to `check-caller`. Set `OCR_ACTION_REF` to the complete pinned
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
