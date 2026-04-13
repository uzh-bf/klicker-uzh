# Element embeddings with pgvector — design document

> This document captures the design for adding vector embeddings to `Element` records. It intentionally avoids implementation-level specifics (exact SQL, schema blocks, function signatures, YAML). Those belong in the implementation PR once this direction is approved.

## Context

KlickerUZH stores every question, flashcard, and content slide as an `Element` row in PostgreSQL. We want semantic representations of these elements so we can, in the future:

- answer student-facing chatbot questions by retrieving the most relevant elements from a course library as grounding context,
- surface "find similar questions" to lecturers who are building quizzes,
- cluster elements by topic for analytics and recommendations.

None of this is possible today because the database has no way to compare elements by meaning — only by tag, title, or full-text search, all of which miss paraphrased or conceptually related content.

This first iteration is foundational: **enable pgvector, decide what text represents each element, and generate an embedding per element asynchronously whenever it is created or updated**. Retrieval (similarity search) is deliberately out of scope for this PR. The goal is to land the storage + generation pipeline cleanly so downstream features can build on it.

Embedding model: `text-embedding-3-small` (1536 dimensions, Azure OpenAI), routed through the existing LiteLLM proxy introduced in commit `23588c919`.

## Goals

1. Enable pgvector on the Postgres instance (local, test, production).
2. Attach a 1536-dim embedding to every `Element` row, updated asynchronously on create/update.
3. Define — explicitly and per element type — what text goes into the embedding, so the representation is principled rather than ad hoc.
4. Avoid redundant API calls when element metadata changes but the embedded content does not.
5. Fit the existing Hatchet worker pattern, the existing LiteLLM env contract, and the existing Prisma migration flow. No new services.

## Non-goals (this iteration)

- Similarity search resolvers or GraphQL queries.
- Chatbot retrieval integration.
- Backfilling embeddings for existing elements (acceptable to leave `embedding IS NULL` until an element is next touched; a dedicated backfill run can happen later once the pipeline is proven).
- Embedding `ElementInstance` rows (the denormalized deploy-time copies). Embeddings live on the canonical `Element`.
- Embedding `AnswerCollection` entries referenced by `SELECTION`-type elements.

## What goes into the embedding (primary design question)

The stated focus for this iteration: decide what actually represents an element semantically. This section is the heart of the design.

### Principles

- **Structured, labeled text, not flat concatenation.** The embedding input has explicit field labels (`Name:`, `Question:`, `Choices:`). This gives the encoder field-level context, reduces ambiguity when some fields are missing, and prevents option text from being confused with question text.
- **Strip markdown, keep math.** Markdown syntax (asterisks, backticks, heading hashes, link brackets) is syntactic noise that inflates tokens without adding meaning. LaTeX math expressions are kept verbatim because they carry genuine semantics for numerical and math questions.
- **Include semantic authored content only.** `name`, `content`, `explanation`, and a narrow set of option fields are in scope when they help represent what the element is about.
- **Exclude pedagogical boilerplate.** Per-choice feedback strings ("Correct!", "This is wrong because…") are excluded — they describe correctness, not topic, and are often templated.
- **Exclude operational and grading metadata.** Tags, status, archive flags, points metadata, timestamps, display settings, validation mechanics, grading ranges, and participant-generated data do not contribute to the topic of the element.
- **Defensive length cap.** text-embedding-3-small accepts roughly 8000 tokens; real elements almost never exceed a few hundred. A hard cap (around 24000 characters) prevents pathological inputs from blowing up the API call, with a warning log if it ever fires.

### Per-element-type rules

Each element type has a different structure. The embedding input reflects that:

| Type | Included | Deliberately excluded |
|---|---|---|
| **SC / MC / KPRIM** | `name`, question body (`content`), `explanation` (if present), list of all choice texts | per-choice feedback, per-choice `correct` flag, display mode |
| **NUMERICAL** | `name`, question body (`content`), `explanation`, `unit` (if present) | accuracy, solution ranges, exact solutions, min/max restrictions, placeholder |
| **FREE_TEXT** | `name`, question body (`content`), `explanation`, list of correct-answer keywords (`solutions`) | max-length restriction |
| **FLASHCARD** | `name`, front (`content`), back (`explanation`) | — |
| **CONTENT** | `name`, body (`content`) | `explanation` |
| **CASE_STUDY** | `name`, description (`content`), `explanation`, list of criterion names, list of cases (each with title + description) | criterion units / ranges / labels, case-level `solutions` |
| **SELECTION** | `name`, question body (`content`), `explanation` | answer collection entries (live in a separate table — v1 skips the join; revisit once the pipeline is stable), `numberOfInputs` |

### Rationale for the two most debatable choices

**Why exclude per-choice feedback.** Feedback strings in the seeded and production data are overwhelmingly short confirmations or short corrections. They describe whether an answer is right, not what the question is about. Including them inflates the input without sharpening the topic vector, and they occasionally introduce fixed phrases that would cluster unrelated elements together on the feedback wording.

**Why include all choices (not just the correct ones).** The space of offered answers defines the conceptual space of the question. A multiple-choice question about thermodynamics that offers "Entropy / Enthalpy / Gibbs free energy / None of the above" is different from one that offers "Temperature / Pressure / Volume / Mass" even if the stem is identical. Including wrong answers is semantically meaningful.

### Deduplication between writes

A SHA-256 hash of the constructed embedding input is stored alongside the embedding. Before calling the embedding API, the worker compares the newly built input hash to the stored one; identical hashes skip the API call entirely. This makes it safe to enqueue from semantic element write paths even when a save only touched out-of-scope fields (for example points metadata), without burning tokens. It is not a justification for enqueueing from unrelated lifecycle-only update paths that never touch semantic content.

## Data model changes

Two new fields on `Element`:

- An embedding column typed as pgvector `vector(1536)`, nullable. Nullable because elements exist before the async worker runs.
- A hash column (text, nullable) holding the SHA-256 of the embedding input that produced the current stored vector.

No side table. Embeddings are a property of the element, not a separate entity. A separate table would add a join to every future similarity query without meaningful benefit — the table will not grow to millions of rows per lecturer.

An HNSW index with cosine distance ops is created alongside the columns. HNSW is chosen over IVFFlat because it works correctly on small or empty datasets without a training phase, and cosine is the correct metric for OpenAI embeddings (which are L2-normalized).

`ElementInstance` is explicitly **not** embedded. Instances are deploy-time snapshots; the canonical content lives on `Element`. Embedding instances would create N duplicates per deployment with no semantic benefit.

## Generation pipeline

The pipeline is **event-driven, asynchronous, and idempotent**.

1. **Trigger.** When an element is created or updated through a semantic element write path, a Hatchet event is emitted fire-and-forget after the database write completes. In v1 this should cover at least the central `manipulateElement` flow in the graphql package and the public-catalog import flow that creates `Element` rows directly. The event carries only the element id. Failures to enqueue are logged but never fail the element save — embeddings are a nice-to-have, not a correctness requirement.

2. **Worker.** A new Hatchet task in the general-purpose worker consumes the event. The task is registered following the same pattern as existing tasks (`createAuditLogEntry`, the scheduled publication tasks). It has a small number of retries to ride out transient LiteLLM / Azure hiccups.

3. **Work performed.** For each event the worker:
   - Loads the element.
   - If the element is missing or soft-deleted, returns successfully (no-op).
   - Builds the embedding input text using the per-type rules above.
   - Computes the SHA-256 hash of the input.
   - Short-circuits if the hash matches what's already stored.
   - Otherwise calls the embedding endpoint (via LiteLLM, using new worker-side OpenAI-compatible client plumbing configured with `OPENAI_BASE_URL` and `OPENAI_API_KEY`).
   - Writes the vector and the new hash back to the `Element` row.

4. **Error semantics.** API errors bubble up so Hatchet's retry logic applies. Validation errors (e.g. excessively long input after the defensive cap fails) are logged and marked failed rather than retried indefinitely.

### Why a Hatchet task, not an inline call

Embedding generation is:

- **Network-bound** — round-trip to Azure OpenAI adds latency that should not block the lecturer's save.
- **Flaky at the edges** — transient failures should not surface as element-save errors.
- **Skippable** — the hash check means most element updates do no work at all.

Hatchet already owns the monorepo's async work pattern. Reusing it keeps the feature consistent with audit logging, scheduled publications, and live-quiz aggregation tasks that all use the same worker.

## Infrastructure changes

- **Local and test Postgres**: swap the base image in both `docker-compose.yml` and the graphql test docker-compose to the `pgvector/pgvector` variant of Postgres 15. This is a drop-in replacement — same port, same credentials, same volume layout — with the vector extension pre-installed.

- **Production Postgres**: the managed instance supports pgvector as an opt-in extension. The Prisma migration issues `CREATE EXTENSION IF NOT EXISTS vector` which is idempotent. Verification during deploy is sufficient — no image or infrastructure change is needed on the managed side.

- **Prisma datasource**: the `postgresqlExtensions` preview feature is already declared on the client generator. The datasource block needs the vector extension added to its extensions list so Prisma is aware of it during migration planning.

- **Prisma migration**: a single new migration enables the extension, adds the two columns, and creates the HNSW index. The migration is additive and backward-compatible (both columns are nullable).

- **Schema sync to analytics**: the existing `sync-schema.sh` script already copies datasource changes into the analytics app's Prisma schema. The Python generator there already has `postgresqlExtensions` enabled, so no script or generator changes are needed.

- **LiteLLM config**: one new model entry in the LiteLLM proxy config, routing `text-embedding-3-small` to the corresponding Azure OpenAI deployment. This requires the deployment to exist on the Azure side — flag as an out-of-band infra prerequisite.

- **Hatchet worker environment**: the general-purpose Hatchet worker pod currently has no OpenAI-related environment variables and no shared worker-ready OpenAI client today. The existing `OPENAI_BASE_URL` and `OPENAI_API_KEY` values (already registered in Turbo's global env and already used by the chat app) need to be injected into the worker's configmap and secret as new worker-side plumbing. The V3 chart's secrets are externally managed, so the API key must be added to the Infisical-backed secret out of band — flag in the PR description.

## Verification plan

- **Unit.** A table-driven test for the embedding input builder, with one fixture per element type. Assertions: the correct type label appears, the expected fields are present or absent per the rules table, markdown is stripped, and no raw `undefined` values leak into the output.

- **Migration + schema.** After running the migration locally, confirm via psql that the `vector` extension is installed, the two columns exist on `Element`, and the HNSW index is created with the expected operator class.

- **End-to-end (authoring path).** With dependencies, apps, LiteLLM, and the general Hatchet worker all running, create a new DRAFT element of each type via the manage UI. Within a few seconds, confirm via psql that each row has a non-null embedding and a 64-character hex hash.

- **End-to-end (public import path).** Import a public catalog element and confirm the imported `Element` row also receives a non-null embedding and a 64-character hex hash.

- **Hash-based skip.** Re-save an element through a semantic save path while changing only an out-of-scope field (for example `basePoints` or `pointsMultiplier`). Confirm no new embedding API call was made and the stored hash is unchanged.

- **Lifecycle boundary.** Exercise a direct lifecycle-only update path that does not modify semantic content. Confirm it does not enqueue embedding work at all.

- **Content change.** Edit the `content` of an existing element. Confirm the hash changes and a new embedding is written.

- **Sanity check for vector quality.** Manually create two conceptually related elements and one unrelated element. Issue a raw-SQL cosine-distance query from psql (no resolver yet — that's follow-up scope) against the first element's vector. Confirm the related element ranks above the unrelated one.

## Out of scope / follow-ups

Each of these is a follow-up PR and not part of this iteration:

- **Backfill script** for existing rows where `embedding IS NULL`. Likely a one-shot script using batched `embedMany` calls.
- **Similarity search resolver** + GraphQL query exposing retrieval to the frontend and the chat app.
- **Chatbot integration** that uses the similarity query to ground answers in relevant elements.
- **`SELECTION`-type enrichment** that joins the linked `AnswerCollection` entries into the embedding input.
- **Demo-seed coverage** for the first-login bootstrap elements created in `packages/graphql/src/services/accounts.ts`, if we decide v1 should cover those in addition to normal authoring and public import flows.
- **Embedding dimension tuning** — text-embedding-3-small supports Matryoshka reduction to smaller dimensions if storage or HNSW build time becomes a concern. Start at the default 1536.
