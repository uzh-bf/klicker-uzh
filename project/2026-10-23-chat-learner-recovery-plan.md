# Recover document reads, retries and dictation

## Approval summary

Restore three existing learner promises: a stalled PDF read must release the
composer, a retried message must describe only the page images actually sent,
and a new dictation session must clear its obsolete error. Keep the existing
document format, model capabilities, file limits, transcript handling and
on-device speech boundary. No dependency, schema, prompt or evaluation changes.

Use a bounded PDF-worker deadline with cleanup, normalize page-review metadata
after image hydration as well as before an early hydration return, and reset
dictation error state centrally when listening starts. Reuse the existing
adapter, request-generation and recognizer test seams. Synthetic browser checks
must exercise the real application with mocked model transport and recognition;
they must not call a model or use learner records.

Approval mode: executable batch, already approved in chat. Authority includes
the scoped source fixes, focused tests, temporary task-local runtime, synthetic
browser evidence, configured reviews, ordinary commits/pushes and one draft PR
against `v3`. Stop the exact local runtime afterward. Mark-ready, merge,
deployment, staging promotion, human-review requests, paid inference and spend
allowance changes remain separate. The existing cumulative evaluation cap is
unchanged. Missing browser evidence stays explicit and blocks claiming completed
UI verification. Success is verified draft source delivery, not live acceptance.

## Execution details

### Context and product impact

Branch `fix/chat-learner-recovery` uses the repository-local
`trees/chat-learner-recovery` worktree, based on `origin/v3` at
`691a63930e303e0f8f8a077aa89433d6ceab27da`. Artifacts remain in `project/`.
Execution mode: standard; selected model identity is unavailable.

| Existing product primitive | Disposition and contract |
| --- | --- |
| Document attachment read | Extend failure recovery with a finite deadline; existing size, content and model policies remain intact. |
| Conversation turn and visual-review evidence | Reuse the existing no-pages normalization so stored/current claims match the final request, including retries after cache eviction and image hydration. |
| On-device dictation session | Reuse error-state ownership; starting a valid session supersedes its previous error without suppressing a new failure. |

No new product primitive, identity, owner, permission or data movement is added.
Marker provenance, title behavior and read-aloud lifecycle are outside this fix.

### Feature-wide test portfolio

| Consequential behavior | Existing primary seam and obligation |
| --- | --- |
| PDF failure releases the composer without leaking workers or disabling another active read | Extend `apps/chat/test/document-attachments.test.ts` through the public adapter using synthetic Worker and fake-clock boundaries: timeout, error response, onerror, synchronous postMessage failure, success and overlapping reads. Assert error code, cleanup and reading-state behavior, not prose. |
| Retry claims match the final page-image payload | Extend `apps/chat/test/chat-response-hydration.test.ts` using its existing store/fetch boundary. Cover absent/evicted cache plus preview-image hydration returning stale metadata; assert final request, both stored arrays, retained document body/full images and a valid-page control. Make model-image support configurable in the existing mock. |
| Fresh dictation clears only obsolete failure state | Extend `apps/chat/test/on-device-dictation.test.ts` through fake Recognition and adapter sessions; fail, restart, clear old error, preserve a new error and local-only audio settings. |

No new permanent test module or assertions on translations, seed contents or UI
wording. Baseline focused checks precede vertical RED/GREEN fixes. Existing
success/cancellation coverage is reused rather than duplicated.

### Ownership and slices

1. **Main: document recovery and evidence accuracy.** Own
   `apps/chat/src/lib/attachments/documentAttachmentAdapter.ts`,
   `apps/chat/src/hooks/useChatResponse.ts` and their two test files above.
   Add a 30-second worker deadline, clear it on every settlement and terminate
   exactly that worker. Preserve `DOCUMENT_ERROR_CODE.readFailed` and release
   the reading counter through existing cleanup. Reuse `dropPageReview` for
   zero-page requests regardless of cache-entry presence; normalize the final
   hydrated trigger before serialization while preserving hydrated images and
   `messages`/`allMessages` consistency. Commit this slice independently.
2. **Executor: dictation recovery.** Own only
   `apps/chat/src/lib/speech/onDeviceDictation.ts` and its existing test above.
   Clear obsolete error state centrally at a new valid listen session. A
   nullable error-state callback is permitted. Preserve transcripts, requested
   cancellation and new error reporting. Main integrates and commits separately.
   This is independent of slice 1 and may run alongside it after plan approval.
3. **Main: integrated verification and draft delivery.** Run focused tests,
   Chat type/lint/build/format checks and scoped hygiene/static checks with the
   pinned container toolchain. Verify the real local UI with synthetic fixtures
   and mocked transport, including useful desktop/mobile and locale variants.
   Capture before/after provenance through the screenshot-gallery workflow.
   Stop and source-verify the exact runtime with zero routes. Complete required
   simplification/risk review and one integrated final review, then publish one
   draft PR with honest CI/browser evidence. No PR exists at plan creation.

Main retains integration, lifecycle, external effects and final proof. Do not
start a CI-repair project or change staging branches/configuration in this PR.
Known unavailable reviewer routes stay unavailable until relevant evidence
changes; preserve the complete review contract through authorized continuity.

## Progress

- Planning challenge round 1 requested final normalization after image
  hydration and explicit worker-failure/concurrency coverage. Both were verified
  against source and accepted. The same planner approved revised round 2.
- Both implementation slices are committed. The document regressions failed
  before their fixes; the focused suite now passes all 52 cases. The complete
  Chat suite passes 831 cases, with 21 opt-in or environment-dependent skips.
  Chat typechecking, production build and ESLint pass (20 existing warnings).
  Changed-file formatting, repository policy checks and a focused source scan
  pass. Host-only launcher checks were rerun on the host after their container
  boundary correctly rejected execution there.
- Synthetic browser checks verify stalled-worker termination and send recovery,
  first-send versus retry page payload/label consistency, retained document text,
  dictation error supersession and subsequent errors. English desktop and German
  compact captures were inspected. Recognition and model transport are mocked;
  these checks do not establish real microphone, model or staging acceptance.
  Image hydration/cache eviction is covered at the request/store test seam.
- Simplification recommends no changes. The independent slice review passes
  the complete six-path implementation range. Integrated final review and
  hosted draft CI remain pending; no PR exists yet.
- Package size: 304 substantive added/deleted lines across six source/test
  paths, excluding this plan. One coherent recovery package; no dependency,
  schema or evaluation changes. Keep the three consequential regressions at
  their existing adapter/request/recognizer seams.
- Durable lesson: normalization must run after hydration can replace a message,
  as well as before a hydration failure can return early. The existing helper,
  comments and regression test retain that contract without another abstraction
  or a duplicate solution document. Next: stop the task runtime, complete the
  final review and deliver the draft against `v3`.
