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

Provider lifecycle commands are launcher invocations. The isolated plan binds
each provider's launcher with an explicit instance, source revision and private
state path, orders setup, and reverses stop. Ingestion setup and start remain
blocked until the provider-owned backing allocations it requires (state DSN,
pgvector, Hatchet, Milvus and OpenAI-compatible bindings) are supplied
explicitly; ingestion status and stop and every scraping, Doc Processing and
Doc Query command are fully derivable. The environment-only
`util/local-kb-stack.mjs plan` cannot derive those bindings and reports
`unsupported: isolated-configuration-required`. Both plan forms return exit
code 2 with `executable: false`; no plan runs the commands it prints.
`status` probes the selected endpoints but never promotes reachability to full
readiness.

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
HEAD and tracked, untracked and ignored changes without printing source paths
or Git errors. Use clean provider checkouts without generated caches; setup
repeats the observation before initialization but does not lock provider trees.
Missing, dirty or mismatched sources return exit code 1. Matching sources return
2 because this check does not inspect processes, backing stores or AI capability.
It neither probes endpoints nor starts services.
Preparation helpers retain an exclusive claim after failure; their existence
alone does not prove a provider was initialized or is serving.

Exclusive configuration preparation writes `bootstrap.compose.json`, containing
backing services and the explicit migration services but no running ingestion
workers. The storage initializer waits for Postgres, then runs Hatchet,
ingestion and document-processing setup in order. Its caller must first verify
live project and volume ownership and supply the host Compose runner. A partial
attempt is retained and cannot be replayed implicitly. The current offline
tests use a fake runner. The explicit setup command wires this sequence:

```bash
node util/local-kb-stack.mjs setup --config /absolute/path/local-kb-input.json --candidate <full-commit-sha>
```

Do not run setup without the separate runtime approval. It requires a fresh,
detached runtime checkout at the supplied candidate and refuses existing state.
It installs isolated managed configuration, initializes owned provider storage,
and obtains the workspace identity through the route-free managed setup profile.
Blob must become healthy before application schema and seed commands run.
The completed preparation receipt binds the application workspace and Docker
context to the completed storage setup. Failure retains the attempt and does
not permit automatic replay. This sequence has offline verification only.

For ingestion revision `69fa7f9200fc17bdb30b9cd792ea4d0e0a907012`, the isolated
plan also includes `ingestionCompose`: the digest-pinned API, callback and eight
worker services, plus an explicit migration service under `local-kb-setup`.
Other ingestion revisions leave that field null until matching image pins are
qualified. The fragment uses the images' Python entrypoints, mounts matching
source read-only, and requires generated local environment and registry files.
It neither reads those files nor produces them. It publishes no host ports and
does not include the remaining providers or backing services. Do not run this
fragment as a complete stack.

The separate `backingCompose` fragment defines Postgres, Redis, Blob storage
and Hatchet with configuration-derived volume names and no published host ports.
It requires local-only environment and database initialization files generated
during exclusive preparation. Hatchet setup is separately profiled; normal
startup invokes the prepared-state wrapper, not the image's automatic migration
entrypoint. Neither fragment creates storage or executes setup during planning.
Backing containers each have a proposed one-CPU, 1 GiB memory limit.

When all four provider revisions match their pinned images, `providerCompose`
combines the provider definitions, including scraping/Crawl4AI, Doc Processing
API and workers, Milvus/etcd/MinIO, and Doc Query. Otherwise it is null. Image
versions come from the inspected provider sources and registry metadata.
Doc Processing uses one shared owned data/extract volume and its published ARM
CPU image; picture descriptions default to off. Doc Query uses the explicit
`local-kb-ai` profile and requires local tool configuration, preventing bundled
configuration fallback. It still needs a separately supplied embedding service.

The generated ingestion environment explicitly requests CPU compute and the
`default` document-processing profile, with picture descriptions off. This
uses the merged ingestion profile-override support in the pinned images.
Keep both ingestion image digests and the matching source revision together
when updating the provider. Local CPU
extraction is not equivalent to the production GPU quality profile.

The Klicker resource-upsert path is distinct from ingestion's document-processing
job path. At the pinned ingestion revision, resource PDF content uses the
provider's `parse_pdf_bytes`, plain text uses UTF-8 decoding, and HTML URL
resources use `parse_url` through the configured scraper. The CPU override does
not prove resource-PDF extraction works. Qualify that path with its own approved
PDF submission rather than treating a healthy Doc Processing service as proof.

The combined Compose structure and focused contracts are tested without
resolving private environment files or starting containers. Generated local
configuration and initial lifecycle commands are implemented. Lifecycle review,
image provisioning and runtime qualification remain unfinished. Do not run
the rendered provider project as a complete local Klicker stack.

Prepared infrastructure has explicit `start`, `resume`, `status` and `stop` commands using
the same `--config` and `--candidate` arguments as setup. These source-only
commands are awaiting lifecycle review and must not be treated as qualified
runtime tooling yet. Start selects stores and APIs plus Manage/Chat; it does
not start ingestion consumers, callback workers, dispatchers or Doc Query.
No schema or seed command runs during start. It claims one startup attempt and
does not implicitly retry or resume after failure or shutdown. Use `resume`
only after a successful initial start and a successful stop of the current
cycle. It selects the same services without migration or seed commands.
Successful stop/resume cycles retain volumes. Concurrent lifecycle operations
are refused, and a failed start or resume retains its attempt for explicit
recovery rather than allowing another launch.
An incomplete resume or stop attempt still permits an explicit, ownership-checked
shutdown. Shutdown preserves that incomplete evidence and does not authorize a
new resume. Malformed or mismatched evidence remains an error.

Status with a candidate reads provider ownership and container state, then
observes Devrouter for the prepared checkout. It rejects a different Docker
context, checkout or workspace and reports only sanitized managed status.
Managed readiness requires a ready `manage,chat` profile without drift. This
is separate from provider health and does not qualify AI capability.
It reports each expected
infrastructure service separately. Missing, duplicate, stopped, starting,
unhealthy or unreported-health containers cannot satisfy the aggregate health
flag. The Compose health probes are local HTTP reads; their coverage differs:

| Service            | Probe                       | What it establishes                                           |
| ------------------ | --------------------------- | ------------------------------------------------------------- |
| Hatchet            | `/ready` on its health port | Queue and repository readiness, excluding shutdown            |
| Ingestion API      | `/ready`                    | Registry readiness and the provider's runtime readiness check |
| Scraping API       | `/ready`                    | Cache readiness; Crawl4AI has its own health probe            |
| Crawl4AI           | `/health`                   | HTTP service liveness                                         |
| Doc Processing API | `/health`                   | HTTP service liveness, not extraction readiness               |

These definitions have offline composition coverage, not execution proof in
every pinned image. In particular, a healthy Doc Processing API does not prove
that its workers or extraction dependencies can process a document.

Stop requires the recorded
local context, exact managed checkout and provider ownership labels; it uses
data-preserving stop operations, never removal. An unconfirmed managed stop or
a provider that remains running is a failed shutdown, not a success receipt.
Full application/provider health qualification remains open before the planned
restart acceptance test. The resume sequence has synthetic-runner coverage;
it has not been exercised against a newly initialized real stack.

Each ingestion container is capped at one CPU and 256 processes. Workers have a
1 GiB memory cap; API, callback and setup each have 512 MiB. These are proposed
local limits, not measured capacity requirements or a successful runtime proof.
Keep the full-stack capacity check and permission to start services separate.

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
