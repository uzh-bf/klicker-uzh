# ADR: Tutor Memory Privacy Gate

Date: 2026-06-17

Status: proposed

## Decision

Persistent learner memory for the Mastra tutor stays disabled by default.

It may only be enabled when all gate checks are true:

- `CHAT_TUTOR_MEMORY_ENABLED=1`
- `CHAT_TUTOR_MEMORY_PRIVACY_APPROVED=1`
- `CHAT_TUTOR_MEMORY_DELETION_SUPPORTED=1`
- `CHAT_TUTOR_MEMORY_STUDENT_TRANSPARENCY_ENABLED=1`
- `CHAT_TUTOR_MEMORY_EMBEDDING_ENDPOINT_APPROVED=1`

The allowed scope is `participantId + chatbotId + courseId`.

Allowed memory categories:

- current course topic
- mastered skills
- prerequisite gaps
- repeated misconception labels
- preferred language
- preferred explanation depth
- unresolved questions

Disallowed memory categories:

- sensitive personal facts
- psychological profiles
- cross-course observations
- cross-student recall
- unbounded free-form summaries
- raw private reasoning traces

Default retention is 180 days unless product/legal choose a shorter course-specific value.

## Mastra Implementation Target

Use Mastra Memory only after this gate passes:

- `@mastra/memory` for memory policy and recall
- `@mastra/pg` `PostgresStore` for storage
- `@mastra/pg` `PgVector` for semantic recall, if embeddings are approved
- semantic recall `topK=3`, message range small
- working memory template scoped to course learner state

No dependency is added in the gate slice. The code currently only evaluates the gate and injects a prompt policy that forbids cross-turn memory unless the gate passes.

## Verification Required Before Enablement

- participant deletion purges `TutorLearnerState` and Mastra memory rows
- chatbot/course deletion purges scoped memory rows
- student can view/delete stored tutor memory
- embedding endpoint and retention are documented
- disclaimer update is accepted before memory is used
- no cross-student or cross-course recall in synthetic tests

## Consequences

The tutor can still use current conversation context, hidden turn state, LightRAG/Milvus retrieval, optional generated tutor guidance, verifier checks, and tutor events.

It cannot claim persistent personalization or continuity until the gate passes.
