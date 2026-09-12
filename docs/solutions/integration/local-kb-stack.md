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
scope and excludes inactive resources. The local model gateway receives no
ambient upstream credentials. A nonempty local SDK placeholder is not an
upstream credential or proof of model availability.

## Provisioning and acceptance

Use fresh application storage and explicit local provider destinations. Normal
Devrouter networking is supported; do not claim network-level internet blocking.
Keep ambient upstream credentials out of the environment. Never reuse an old KB
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
