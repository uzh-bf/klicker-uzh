# Tutor Rollout

Date: 2026-06-17

## Flags

Core routing:

- `CHAT_USE_MASTRA_ENGINE=1`
- `CHAT_API_BASE_URL`

Tutor behavior:

- `CHAT_TUTOR_STATE_MODEL_ID` optional planner model override
- `CHAT_TUTOR_STATE_LOG=1` logs hidden state and tutor attributes
- `CHAT_TUTOR_VERIFIER_LOG=1` logs preflight and posthoc verifier outcomes
- `CHAT_TUTOR_EVENT_LOGGING_ENABLED=0` disables best-effort `TutorEvent` writes

Memory gate:

- `CHAT_TUTOR_MEMORY_ENABLED=1`
- `CHAT_TUTOR_MEMORY_PRIVACY_APPROVED=1`
- `CHAT_TUTOR_MEMORY_DELETION_SUPPORTED=1`
- `CHAT_TUTOR_MEMORY_STUDENT_TRANSPARENCY_ENABLED=1`
- `CHAT_TUTOR_MEMORY_EMBEDDING_ENDPOINT_APPROVED=1`
- `CHAT_TUTOR_MEMORY_RETENTION_DAYS`

Do not enable persistent memory until the memory privacy ADR is approved and deletion/transparency tests exist.

## Order

1. Internal synthetic chats with `tutor-skills-v1`.
2. Local seeded dev with structural evals passing.
3. Staging with staff accounts and `CHAT_TUTOR_STATE_LOG=1`.
4. One low-stakes course chatbot with posthoc verifier only.
5. Lecturer-approved skill pack for one module.
6. Broader finance topics after MathTutorBench and local eval results are stable.

## Gates

Required before staging:

- `pnpm --filter @klicker-uzh/chat-engine check`
- `pnpm --filter @klicker-uzh/chat-engine test`
- `pnpm --filter @klicker-uzh/chat-api check`
- `pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_tutor_structural.ts --no-write --run-id smoke`
- chat-api smoke against a real model

Required before course pilot:

- no increase in answer leakage structural failures
- no unsupported citation failures in the RAG suite
- MathTutorBench subset report comparing `current` and `tutor-skills-v1`
- lecturer approval for active skill/misconception/hint records
- dashboard checks for tutor move, hint depth, verifier failures, retrieval, and memory gate status

## Non-Goals For First Rollout

- verifier blocking mode
- persistent memory
- cross-course personalization
- automatic lecturer-content publishing
- many-agent orchestration
