---
type: Solution
title: Local KB stack qualification boundaries
description: Distinguish the isolated dependency plan from service startup and actual ingestion or retrieval proof.
module: local-kb
date: 2026-09-08
problem_type: workflow
severity: medium
tags:
  - knowledge-base
  - ingestion
  - local-development
---

# Local KB stack qualification boundaries

The ordinary Devrouter `full` profile starts Klicker applications and their core
dependencies. It does not start the external ingestion, document-processing,
scraping and retrieval services. A successful Manage login or ingestion API
health response therefore does not establish end-to-end readiness.

## Current tooling boundary

The isolated lifecycle invokes the supported provider launchers. Klicker owns
only its application configuration, source-upload storage, database, Redis and
Hatchet. Each provider owns its backing services and retained state. The runner
does not recreate provider Compose files or initialize provider databases itself.

Use an explicit JSON input matching `resolveIsolatedConfig` in
`util/local-kb/isolated-config.mjs`. Supply clean canonical provider roots and
full source revisions, explicit non-overlapping consumer/provider ports, and
immutable ingestion API and worker image digests. Input observations are not
live evidence. The provider launcher verifies its own installed image contract.

```bash
node util/local-kb-stack.mjs plan --config /absolute/path/local-kb-input.json
node util/local-kb-stack.mjs status --config /absolute/path/local-kb-input.json
```

Plan returns exit code 2 with `executable: false` and runs no commands it prints.
Status without a candidate checks provider source custody, not processes or
models. It allows an ignored `.venv/` needed by frozen/no-sync Python launchers;
other ignored or untracked state, including `.env`, is rejected. This does not
prove that the virtual environment is installed or matches the lockfile.
No missing dependency is installed implicitly.

Use dedicated detached provider checkouts for qualification. Keep development
review artifacts and test caches in their original worktrees. Install locked
dependencies in each qualification checkout before setup, then verify that
only ignored `.venv/` state exists. Provider commands disable Python bytecode
writes; document processing receives the same setting in its explicit child
configuration. Ingestion must also preserve this setting in its own sanitized
subprocess environment. A consumer setting alone cannot control a provider
that rebuilds its child environment.

The explicit lifecycle uses the same input and full candidate commit:

```bash
node util/local-kb-stack.mjs setup --config /absolute/path/local-kb-input.json --candidate <full-commit-sha>
node util/local-kb-stack.mjs start --config /absolute/path/local-kb-input.json --candidate <full-commit-sha>
node util/local-kb-stack.mjs status --config /absolute/path/local-kb-input.json --candidate <full-commit-sha>
node util/local-kb-stack.mjs stop --config /absolute/path/local-kb-input.json --candidate <full-commit-sha>
node util/local-kb-stack.mjs resume --config /absolute/path/local-kb-input.json --candidate <full-commit-sha>
```

These commands mutate local runtime state and require separate runtime approval.
They currently have synthetic-runner verification, not a completed fresh-stack
acceptance test.

Setup requires a fresh detached runtime checkout at the candidate and refuses
existing preparation state. It writes private per-provider inputs, initializes
Klicker backing, invokes each provider's explicit setup and initializes the
disposable application database through the route-free managed setup profile.
A completed receipt binds provider preparation, workspace, candidate and local
Docker context. Partial failure retains its claim and cannot be replayed silently.

Start invokes scraping and document processing, starts Klicker with
`ai,chat,manage` so the local model gateway is included, then invokes ingestion
worker activation and retrieval. It never calls setup, migrations or seeding.
Resume requires a successful stop of the current cycle and uses the same startup
path. Concurrent operations and implicit replay after failure are refused.

Stop checks provider identities before invoking the reverse provider order.
It verifies stopped observations before stopping Klicker and its backing.
Provider stop may remove its own containers while retaining volumes and state;
the consumer does not request data deletion. Incomplete attempts remain visible
and do not authorize another resume.

Status validates provider instance/revision and the prepared managed checkout.
It reports sanitized preparation, endpoint readiness and shutdown observations.
Endpoint health does not establish worker registration, extraction, embeddings,
retrieval or paid-model capability. `aiQualified` remains false. Neither an empty
workload list nor a healthy API is proof of successful ingestion.

Consumer backend, Blob and model ports use explicit loopback publications.
Provider port handling is owned by the selected provider revisions and must be
checked before activation; do not infer loopback isolation from this consumer
configuration. Host processes use loopback destinations; containers use
`host.docker.internal` for host-published services. Container reachability must
be qualified on the actual host platform.

The private ingestion inputs select CPU compute, the default document-processing
profile and no picture descriptions. Provider artifacts use the provider's
isolated Azurite, separate from Klicker's source-upload storage. Ingestion and
retrieval share the derived collection identity; retrieval requires signed KB
scope and excludes inactive resources. By default the local model gateway receives no
ambient upstream credentials. A nonempty local SDK placeholder is not an
upstream credential or proof of model availability.

## Opt-in OpenRouter upstream

### Interrupted preparation

Normal `setup` deliberately refuses an existing preparation attempt. A reviewed
recovery checkout can continue the completed configuration/storage prefix with:

```bash
node util/local-kb-stack.mjs continue-setup \
  --config /absolute/path/local-kb-input.json \
  --candidate <retained-application-commit> \
  --executor <recovery-checkout-commit>
```

The executor must be committed and clean; the retained application remains at
its original detached revision. The command verifies provider status, preserves
completed receipts, and reconciles missing receipts only for prepared, stopped
providers. It initializes ingestion or retrieval only when their state and
runtime resources are absent. It never retries a failed provider or token
operation. An incomplete continuation is retained and cannot be invoked again.

The one supported generated-configuration correction replaces the old empty
`local-kb-setup` profile with a route-free profile selecting `redis_exec`.
Every other generated byte must match the expected configuration. A retained
intent precedes that correction; failure leaves the attempt for diagnosis.
The setup profile starts no application processes or model service.

As with setup, an opted-in AI configuration requires the runtime environment
below. Successful continuation proves preparation only; credential transport,
PDF ingestion, citations and retained restart still require acceptance tests.
Review the exact executor/candidate pair before executing recovery.

Set `"aiUpstream": "openrouter"` in a fresh isolated input to enable real model
and embedding calls. Omit it for the existing credential-free mode. The mode
is part of the preparation identity: changing it on retained state is rejected.
Public or synthetic content sent through this mode reaches OpenRouter and
incurs ordinary model and embedding usage.

Configuration-derived invocation, after host operator setup and runtime approval:

```bash
rs-infisical-operator --profile <approved-profile> run \
  --map OPENROUTER_API_KEY=UPSTREAM_OPENAI_API_KEY -- \
  env UPSTREAM_OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
  node util/local-kb-stack.mjs setup \
    --config /absolute/path/local-kb-input.json --candidate <full-commit-sha>
```

Use the same wrapper for `start` and `resume`. These three verbs reject missing
credentials or a different upstream endpoint before claiming an attempt or
activating providers. Setup validates the injection but does not forward it to
its route-free managed profile. Only the managed `ai,chat,manage` startup
receives the two upstream environment variables from this launcher. Its generated
Compose declares name-only references exclusively for LiteLLM. The trusted
host launcher and initialization hook inherit that environment; containment
through the installed Devrouter/Devsy versions still requires runtime proof.
Never put the key in the input, generated files, workspace arguments, logs or
receipts.

`status` and `stop` use the ordinary commands without the operator wrapper.
Resume requires fresh injection; a rejected missing-key resume consumes no
attempt. Validate the installed Devrouter/Devsy environment transport with a
synthetic sentinel before using a real key. Require its presence in LiteLLM and
absence from the app and other container environments, generated workspace,
Compose and override files, lifecycle logs, status output and preparation
receipts. Check both initial startup and retained resume without printing the
sentinel or later real credentials. Unit checks do not qualify that transport
or establish successful retrieval.

## Provisioning and acceptance

Use fresh application storage and explicit local provider destinations. Normal
Devrouter networking is supported; do not claim network-level internet blocking.
Keep upstream credentials out of unrelated commands. Never reuse an old KB
binding or restart retained workers as a substitute for isolated qualification.

Prefer verified immutable provider images over local cold builds. The ingestion
worker's existing Dockerfile needs private package-index credentials. Having no
model key at runtime does not remove that build-time requirement. Keep credential
injection and image provisioning separate from read-only planning.

The eventual acceptance sequence is explicit setup, startup, process and
dependency readiness, then one separately approved ingestion and retrieval
proof. Startup must not rerun migrations or silently retry partial setup.
Missing model credentials leave AI capability unqualified even when local
services are healthy. Graph and question-generation proof is separate.

Until runtime acceptance is complete, there is no qualified one-command full
local KB stack in this launcher. The API-only
helper documented in the [devcontainer guide](../../../.devcontainer/README.md#local-kb-ingestion-and-graph-builder)
does not fill that gap.
