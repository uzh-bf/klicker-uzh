# Assessment chat transcripts through the assessment export

## Status

Approval mode: direction-only. The user decided on 2026-11-16 that lecturer transcript downloads for exam chatbots go through the attested assessment export of #6253, not through a separate chat route. The transcript builder moved here from #6878, which stays open and unmerged as a fallback until this layer is wired and merged.

This layer currently carries only the builder and its unit tests, unwired:

- `packages/graphql/src/lib/chatTranscriptExport.ts`: thread ordering under the stored parent tree, branch and failure markers, roster reconciliation against participations and invitations, HTML transcripts and the CSV index. Reasoning, tool internals and prompt bodies are never exported.
- `packages/graphql/test/chatTranscriptExport.test.ts`: the synthetic-thread tests carried over unchanged.

## Remaining work

1. **Chatbot scope.** Add a `CHATBOT` scope to `assessmentExportRequestSchema`. The service accepts only a chatbot of an assessment-enabled course and keeps the course ADMIN check, the attestation and the receipt flow of `downloadAssessmentExport`.
2. **Receipt.** Add a nullable `chatbotId` to `AssessmentExportReceipt` inside the existing unmerged receipt migration, so the stack keeps one migration.
3. **Artifact.** Read participations, invitations and chat threads inside the export transaction, build the transcript export, and enforce size limits that fit transcripts.
4. **Identity.** Align the roster identity with `getAssessmentResultsCourse`, so the points export and the transcript export name each student the same way.
5. **Interface.** Offer the chatbot scope from the assessment results page in the management app.

## Open decisions

- Download shape: JSON plus HTML per student, a single combined HTML, or an archive (no archive library exists yet).
- Disclosure: whether identified transcripts need attestation text and a disclosure version beyond `v1`.
- Integration: #6253 is far behind `v3-ai`; bringing it current and changing its migration belongs to the DPO stack owner and needs the user's ruling.

## Authority

Granted: this branch, a draft PR stacked on `rs/dpo-course-exports`, local commits and pushes. Withheld: changes to #6253's branch, merging, marking ready, deployment.
