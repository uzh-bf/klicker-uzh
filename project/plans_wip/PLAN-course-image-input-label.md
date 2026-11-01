# Course-image model-input label

Record whether the selected figure's pixels were attached to the model input
before selection, and show that evidence beside the image tool details.

- Scope: request-local Chat preview preparation, validated selection results,
  persisted tool output, ToolFallback, and matching English/German labels.
- Keep provenance separate from retrieved figure metadata and model arguments.
  Match the exact KB/resource/version/asset/manifest occurrence; prepared but
  unattached previews do not count. Snapshot evidence before asynchronous display
  validation, so later steps cannot relabel an earlier selection.
- Show “Pixels provided to model” or “Description only” for new successful
  selections. Omit the label for older or invalid results. This records supplied
  input, not whether the model used or understood it.
- No schema migration, GraphQL, auth, gamification, Hatchet or backend contract
  changes. Preserve bounded readers, shared selection promises and image limits.
- Verify the actual SDK request/selection/persistence boundary, failure and
  unmatched-result fallbacks, legacy data, concurrency and translations. Run
  focused regressions, full Chat tests and normal hooks; check the local demo
  before/after and after reload. Update the existing consolidated PR #6312.

## Verification results

- Focused vision, selection, Azure and tool-display tests: 80 passed.
- Full Chat suite: 1,781 passed, 33 service-dependent skips. Chat typecheck passed.
- SDK continuation tests check actual file parts before the selection tool call,
  with both successful and failed previews; persisted selections carry matching
  evidence. Existing Azure bounds/ETag/digest and duplicate-selection tests pass.
- The separate retained demo received only the scoped label changes. A fresh
  public Docling answer showed “Pixels provided to model”; the original saved
  answer remains unlabeled. No private course documents or new ingestion.
- The review runtime manager has a stale stopping state with no active worker.
  Verification uses the existing container after checking its exact review-path
  bind mount. The temporary hook adapter runs every normal check/build command
  there; it does not skip hooks or change lifecycle state or other services.
