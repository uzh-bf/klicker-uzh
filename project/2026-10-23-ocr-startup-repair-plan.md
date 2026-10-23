# OCR startup repair

## Approval summary

Credential-free OCR children need every Git object in their frozen review range
to be available locally. A sparse checkout can create a partial clone even with
complete commit history. An unfetched blob then requires a remote request while
the child has no forge credentials. Fix private-adopter startup by using a full
trusted-policy checkout and keeping candidate source in Git objects.

Extend the shared progress filter with fixed `git_diff` and `merge_base` fatal
classifications. Match only the pinned CLI's complete root prefixes, discard
their untrusted suffixes, and preserve the existing process exit result. Keep
the model, reasoning, token ceilings, accounting, retries and concurrency intact.

Approval mode: executable batch. The user's go-ahead covers source changes,
synthetic verification, configured reviews, ordinary commits and pushes, and
draft PRs for the shared engine against `v3` and its private adopter against
`main`. Ordinary automatic CI remains enabled. Extra paid canaries or replays,
merge, readiness, credential or variable changes and deployments are excluded.
Live acceptance follows the next normal review after the source is merged.

## Execution details

Execution mode: standard. Main owns the cause investigation, private adopter,
integration and delivery. A bounded executor may edit only the public progress
filter and its synthetic tests. The planner sees both repositories through a
trusted native route. Public artifacts describe the generic mechanism and
synthetic proof; private runtime evidence stays local.

1. Extend `.github/scripts/ocr-mistral-adapter.cjs` and its existing test for
   exact Git input failure prefixes. Reuse the existing bounded line filter,
   root-only matching, once-per-process event and best-effort logging.
2. Remove sparse checkout from the adopter's trusted-policy checkout, retain
   `fetch-depth: 0` and `persist-credentials: false`, and extend its existing
   parsed-workflow tests to reject partial clones and shallow history. Keep
   the publisher's independent sparse checkout. Update the launcher's engine
   constant and both workflow pins to the committed public source, with the
   copied skill blob unchanged.
3. Update the existing CI guides, advisor roadmap and adopter plan. Capture the
   generic missing-blob lesson in the existing
   `docs/solutions/integration/opencodereview-tool-call-preflight.md` rather
   than adding another solution page. No new executable module is needed.

### Acceptance and delivery

Extend existing fatal-classification/privacy and checkout-policy tests. Use no
tests for prose and no new obligations for unchanged review policy. Reuse the
model, accounting, retry and released-binary synthetic suites. A synthetic
promisor clone must fail before provider dispatch when its missing blobs cannot
be fetched; a full clone of the same range must load its diff offline.

Run focused source suites, the checksum-verified released binary against mock
providers, repository formatting and applicable static checks. Inspect staged
content for secrets, personal data and real-environment observations. Source
reviews cover the committed package before completed draft delivery. Keep the
adopter's engine immutable and inspect intervening source before updating it.
Read activation status without secrets before publication; preserve it.

Publish the public engine draft first, then the adopter draft pinned to that
public commit. Record hosted CI as pending until its producing checks finish.
Both PRs remain draft; this package stops at verified source delivery.

## Progress

- Synthetic partial-clone reproduction fails while the equivalent full clone
  loads the same diff offline. The pinned checkout action selects `blob:none`
  when sparse checkout is requested.
- Initial public and adopter source suites pass; the released-binary mock
  provider fixture also passes. The adopted engine's intervening executable
  source and copied reviewer skill are unchanged.
