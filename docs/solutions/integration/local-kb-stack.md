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

`util/local-kb-stack.mjs plan` describes provider commands using explicit provider
paths in the environment. It returns exit code 2 and `executable: false` because
service rendering and lifecycle integration are incomplete. It does not run the
commands it prints. `status` probes the selected endpoints but never promotes
reachability to full readiness.

To inspect a full isolated configuration, use an explicit JSON input matching
`resolveIsolatedConfig` in `util/local-kb/isolated-config.mjs`:

```bash
node util/local-kb-stack.mjs plan --config /absolute/path/local-kb-input.json
```

This command is verified with synthetic inputs and returns exit code 2. It
describes owned storage, provider source revisions, endpoints and dependencies.
Its supplied source observations are not a live Git or filesystem audit.
Use `status --config /absolute/path/local-kb-input.json` on the host to verify
provider checkouts against those revisions. It checks canonical repository roots,
HEAD and tracked/untracked changes without printing source paths or Git errors.
Missing, dirty or mismatched sources return exit code 1. Matching sources return
2 because this check does not inspect processes, backing stores or AI capability.
It neither probes endpoints nor starts services.
Preparation helpers retain an exclusive claim after failure; their existence
alone does not prove a provider was initialized or is serving.

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

Until concrete service rendering and lifecycle integration are complete, there
is no supported one-command full local KB stack in this launcher. The API-only
helper documented in the [devcontainer guide](../../../.devcontainer/README.md#local-kb-ingestion-and-graph-builder)
does not fill that gap.
