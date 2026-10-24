# Clear document presentation and dictation dialogs

## Approval summary

The user approved the focused learner-facing follow-up identified during the
staging-sync review: document titles and exports, accurate PDF-page disclosure,
and dictation-dialog behavior. This executable batch implements that scope and
delivers one draft PR against `v3` with synthetic browser evidence.

Reuse the existing document-block parser to keep internal attachment blocks out
of fallback conversation titles, title filtering and exported user questions.
Study-note exports retain assistant answers, mathematics and citations, while
stored messages, attachment chips and retrieval content stay unchanged. Clarify
the existing EN/DE notice: document text and selected rendered PDF pages can go
to the model provider; KlickerUZH stores document text and generated visual
summaries, but does not persist the rendered page images. Do not promise
anything about provider-side retention or transient browser caching.
Repair focus after the dictation dialog mounts and apply Chat's existing button
colors to its primary action. Preserve local-only speech and existing dismissal,
installation, error and cancellation behavior.

Success means reproduced behavioral failures have focused regression protection,
the real synthetic UI proves the changed states in EN/DE and desktop/compact
viewports, applicable source checks and independent review pass, the exact local
runtime is stopped, and a draft PR is pushed with verified screenshot links.
Generated answers and real microphone/provider behavior remain unassessed.

Approval covers local synthetic runtime/browser checks, required role reviews,
commits, ordinary task-branch push and draft publication. It does not authorize
mark-ready, merge, staging promotion, deployment, live settings or paid evaluation.
The cumulative chatbot evaluation allowance remains US$5, with no new inference.

## Execution details

- Repository: KlickerUZH, worktree `trees/chat-document-presentation`.
- Branch: `fix/chat-document-presentation`; target `v3`.
- Frozen baseline: `aa387a8fb01581dcc09823233f7a63e2a6fb9c61`.
- Artifact root: `project/`; private receipts and screenshots remain ignored.
- Execution mode: standard; exact main-model identity is unavailable.
- Ceremony: full path because export presentation is a user-visible contract.
- Delivery: one ordinary draft PR; no stack or forward-sync mutation.
- Existing learner-recovery PR is already merged. This package completes its
  remaining presentation boundary; no open related draft owns these changes.

### Primitive impact

| Existing primitive | Disposition | Contract and consumers |
| --- | --- | --- |
| Conversation message and document attachment | Reuse | Stored blocks and ownership remain intact; title/export presentation uses the existing typed-question projection. |
| Study-note export | Compose | User-facing question/answer text, mathematics and citations remain; raw extracted attachment blocks are excluded. No stored data is removed. |
| Document-sharing reminder | Reuse | Copy distinguishes provider transmission, KlickerUZH text/summary persistence and non-persistence of page images; no provider-retention promise, new consent or data flow. |
| On-device dictation session | Reuse | Dialog focus/style changes only; no network speech or microphone access in synthetic tests. |

No new product primitive, schema, dependency, ADR or protocol is required. The
changes use existing presentation and parser contracts. Reopen the decision only
if a fix requires stored-format changes, a different data boundary or new runtime
capabilities. Research uses repository source and installed UI packages; no
external API assumption is needed.

### Ownership and sequence

1. Main owns product assumptions, this derived plan, disclosure/dialog source,
   integration, runtime, browser evidence and publication. One read-only planner
   hardens this frozen plan before implementation. No matching review exists.
2. A configured executor owns `apps/chat/src/components/thread-list-state.ts`,
   `apps/chat/src/lib/thread-markdown.ts`, and their existing tests
   `apps/chat/test/thread-list-filter.test.ts` and
   `apps/chat/test/thread-markdown.test.ts`. Its settled contract is to strip only
   well-formed user document blocks using the existing parser, preserving stored
   titles and assistant content. It makes no commits or external actions.
3. In parallel, main owns `apps/chat/src/components/dictation-controls.tsx`,
   `packages/i18n/messages/en.ts`, `packages/i18n/messages/de.ts` and the affected
   paragraphs of `docs/chat-platform.md`. Reuse existing focus/color patterns;
   no new helper, component or dialog lifecycle. Other source paths are excluded.
4. Integrate and verify one coherent implementation slice, then commit. Run the
   simplifier and one risk-selected reviewer on that immutable complete slice.
   A single focused correction per reviewer is the limit. Main owns all secrets
   and runtime effects; worker ownership remains disjoint.
5. Main verifies the integrated browser contract and production build, creates
   the screenshot gallery, stops the exact runtime and verifies shutdown. Run
   one integrated final review, then push and create a draft PR with the whole
   branch description and gallery. Handle genuinely in-scope CI findings;
   inherited source/tooling findings remain explicit, not silently repaired.

No native goal is requested for this package. There is no active monitor for
the previous sync task. A later automatic follow-up requires named authority.

### Verification portfolio

| Consequential risk | Obligation and stable seam | Distinct failure |
| --- | --- | --- |
| Internal blocks leak into untitled titles or filtering | Extend existing title-filter tests using minimal synthetic structured fixtures | Short question is followed by an internal header; document-body words match a title filter. |
| Export changes meaningful answer content or source storage | Extend existing Markdown tests for string and text-part user content, assistant literal content, and input immutability | User block leaks, assistant text is stripped, or stored input changes. |
| Dialog focus misses its delayed content, button loses contrast | Existing synthetic browser harness, no new maintained unit test | Opening a static install state leaves focus on the obscured composer; CTA computed colors are missing. |
| Notice omits rendered-page transmission | EN/DE live browser inspection and localization structure checks | The notice fails to explain the existing page-image boundary. No prose assertions. |

Use focused RED/GREEN tests for the two pure seams, then Chat types/lint/full
unit suite and production build in the pinned container toolchain. Run staged
format, identity, secret and private-data checks. Reuse unaffected evidence.
Tests never pin translation wording or seed records. Preserve literal document
marker assertions only where they test the stored machine format itself.

### Browser acceptance and evidence

Use the exact task runtime and seeded synthetic account only. Intercept model
requests with deterministic local fixtures; do not send an inference request.
Exercise document attachment, first-use notice, title filter and downloaded
Markdown, plus dictation install/ready/error states with a synthetic recognition
adapter. Assert no actual speech/microphone or external model call occurs.

Capture before/after states, EN desktop1440x1000 and DE compact390x844, including
focused dialog action, CTA computed colors, notice and a clean question/export.
Record DOM interactions as well as images. Check close/Escape focus return and
keyboard reachability. Dictation checks use a desktop browser with synthetic
capabilities, optionally at a narrow viewport. A genuinely mobile-emulated
browser must keep dictation absent. A compact viewport is not mobile-browser
qualification. Notice rendering does not qualify provider retention. Label
mocked capabilities and untested real microphone/provider behavior explicitly.

New optional files are limited to ignored
`project/_local/presentation-browser/` fixtures, captures, manifest and gallery,
and `project/_local/reviews/` gate reports. Upload only inspected synthetic
screenshots to this repository through authenticated host `gh`; verify links.

## Progress

- User approved the bounded package on24October2026.
- Fresh remote state and existing owners checked; task worktree clean at baseline.
- Planner Leibniz approved round2 after precise retention and desktop/mobile
  distinctions were accepted. Implementation starts under existing user approval.
- Existing regression files extended with six synthetic cases; no new test file.
- Implemented parser-based titles/filter/export, EN/DE disclosure and dictation
  mounted-action focus/theme. Full Chat853pass/21skip, types/lint/production build
  and scoped static checks pass; browser export/filter/provider-notice DOM checked.
- EN/DE notice DOM, synthetic export/filter and initial action focus passed.
  Screenshot compositor timed out after fonts loaded; earlier partial-animation
  captures were rejected. Focus return after dismissal remains unqualified.
  No completed visual or microphone/provider acceptance is claimed.
- Simplifier found no net simplification. Slice reviewer passed the eight-file
  implementation and its single focused timer correction. Integrated final
  review and hosted CI remain pending; the draft will retain visual limitations.
- Substantive size: 140 additions/22 deletions across code, translations and tests; plan/docs
  excluded.
- PR: none yet.
