# Tutor Observability Dashboard

Date: 2026-06-17

Use tutor events and log attributes as the first dashboard source. Mastra native spans are already wired through `withObservability`; the tutor layer now emits stable `tutor.*` attributes for logs/events.

Core fields:

- `tutor.chatbot_id`
- `tutor.course_id`
- `tutor.mode`
- `tutor.model_id`
- `tutor.skill_pack_version`
- `tutor.current_skill`
- `tutor.student_state`
- `tutor.move`
- `tutor.hint_depth`
- `tutor.misconception_label`
- `tutor.retrieval_needed`
- `tutor.retrieved_evidence_count`
- `tutor.leakage_allowed`
- `tutor.preflight_risk`
- `tutor.preflight_failures`
- `tutor.output_verifier_passed`
- `tutor.output_verifier_failures`
- `tutor.memory_status`

Recommended dashboard panels:

- tutor turns by `tutor.move`
- hint-depth distribution
- verifier failures by failure type
- citation-fidelity failures over time
- retrieval-needed vs retrieved-evidence count
- memory gate status
- feedback uptake rate from `TutorEvent.feedback_uptake_detected`
- model cost by tutor stage once stage cost attribution is added

Alert candidates:

- unsupported citation rate above baseline
- answer leakage detected in posthoc verifier
- memory status `enabled` before the privacy ADR is approved
- high retrieval-needed count with zero retrieved evidence
