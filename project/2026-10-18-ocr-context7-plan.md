# Bounded library documentation for OCR

## Approval summary

The user approved adding Context7 to the merged OCR tool broker. Add one
`lookup_library_docs` tool for public library/API questions, using Context7's
Search API through the trusted parent. Share four attempted uncached lookups
across the run, with a 15-second deadline, an 8 KiB returned envelope and a
small completed-result cache. Preserve existing OCR models, reasoning, token
accounting, budgets, retries and the two independent advisor attempts.

Library IDs come from a trusted parent allowlist, initially the public Next.js,
React, Prisma and TypeScript documentation. The reviewer reads dependency
versions from the reviewed source and supplies a version hint. Return requested
and served versions with explicit uncertainty; documentation is untrusted
evidence, never review policy. Send no automatic source excerpts or PR/MR text.
Reject obvious code, URLs, credential-like content and oversized queries.
These checks reduce accidental exposure; they are not semantic data-loss
prevention. Private-repository adopters must explicitly authorize their public
query policy. Context7 stores queries and uses external reranking providers.

Completion means synthetic provider and pinned-CLI proof, independent review,
ordinary commits/push and a draft PR against `v3`. The existing CI secret is
passed only to the parent. No secret changes, live OCR replay, merge, ready
transition, deployment or application runtime is authorized. Context7 service
cost is separate from draft/advisor model estimates: four Pro overage calls
have a USD 0.02 reference estimate, excluding subscription and model tokens.
The actual account allowance is unknown and must not be inferred from receipts.

## Execution details

Approval mode: executable batch. Boundary owner: self. Execution mode: standard
(runtime model identity unavailable). Full path for the new external data and
credential seam. One cohesive ordinary PR; this adds one tool to the existing
broker, without a new dependency, module or independent deployment. No product
primitive or persistent application data changes. The ADR gate is not armed:
this source extension is reversible and retains the established broker boundary.

Repository: `uzh-bf/klicker-uzh`; target `v3`, baseline
`f6df1bbb83ccf07e52e5bb7e9dee0eec3fae98a0`. Worktree `trees/ocr-context7`,
branch `rs/ocr-context7`. The earlier package is recorded in
[the advisor plan](2026-10-18-ocr-review-advisor-plan.md).

### Contracts

- Use only `https://context7.com/api/v3/search`, bearer auth in the parent,
  redirect rejection, one library per request, JSON responses and no retries.
  Expose no URL, credentials, arbitrary headers or source-context parameters.
  Inputs: `libraryId`, `query`, optional `version` and `language`. The trusted
  runner supplies at most 32 public IDs; tool schema advertises available IDs.
  Initial IDs: `/vercel/next.js`, `/reactjs/react.dev`, `/prisma/web`,
  `/microsoft/typescript`, resolved against Context7's official catalog.
  Reject unknown fields. Queries are trimmed, single-line public API topics,
  at most 500 characters, with obvious code/URLs/credentials rejected. Version
  hints are at most 64 characters and match optional `v`, one to three numeric
  components and an optional alphanumeric prerelease/build suffix. Language
  accepts only TypeScript, JavaScript, Python, Go, C#, Java, Rust, SQL, JSON,
  YAML, CSS or HTML. Invalid outbound fields trigger no provider request.
- The broker accepts a scoped `context7ApiKey`, `publicLibraries`, and injectable
  `context7FetchImpl` for synthetic tests. Missing credentials or an empty
  allowlist leave the tool explicitly unavailable, independently of the advisor.
  Keep the third tool registered even when unavailable, and preflight discovery
  for all three expected tools before launching OCR.
- Separate `docs` diagnostics record status, attempted, upstream attempts,
  completed, failed, rejected, cache hits, cancelled and unresolved usage.
  Reserve one of four attempts synchronously before asynchronous work. Invalid
  inputs count as rejected without external requests; valid failed lookups
  consume attempts. Completed cache hits consume no further service attempt.
  Validate and check the completed cache synchronously first, then reserve a
  slot only for a valid uncached miss before dispatching upstream I/O.
  Concurrent identical misses may use separate slots; no shared-promise layer.
  Cache identity includes normalized library ID, query, version and language.
- Use a per-call AbortController under the existing cancellation/close path.
  Apply the 15-second deadline to headers and body; raw responses are bounded
  at 256 KiB. The completed cache holds at most four results. Never cache errors.
  Cancellation must remain cancellation even if it races completion.
  Distinguish the deadline from caller/disconnect/runner cancellation. Deadline
  expiry is a failed, unknown-usage docs lookup, not a client cancellation.
- Validate the JSON envelope and normalize only documented snippets, source
  links and library/version metadata. Filter mismatched library IDs, retain only
  HTTPS source links, and ignore returned rule/instruction fields. Returned
  JSON, including metadata and truncation flags, is at most 8 KiB. Indicate
  truncation, no matching docs and unavailable/version-unverified outcomes.
  Unverified version metadata never implies exact compatibility.
  Probe fields: `codeSnippets` entries carry `libraryId`, `codeTitle`, `codeId`
  and `codeList[{language,code}]`; `infoSnippets` entries carry `libraryId`,
  `pageId` and `content`. Ignore unsupported fields. Return requested version
  separately from provider-served version. A verified result requires consistent
  `version.status` and its one matching `version.libraries` entry, a served
  version agreeing with that library ID's version suffix, and a match to the
  requested numeric prefix (or exact prerelease). Missing/contradictory metadata
  yields explicit unverified status; an echoed request alone proves nothing.
- No raw query, code, docs text, library ID, key, URL or provider error enters
  diagnostics, job logs or uploaded receipts. Tool results carry bounded docs
  only to the reviewing model. Failure continues ordinary source review and
  leaves both existing advisor attempts available.
- Persist docs counters in the existing sanitized tools receipt. Summaries print
  docs status, counters and a separately labelled Pro-overage reference estimate
  at USD 0.005 per observed service request. It excludes subscription costs,
  included allowances and model tokens; failed/disconnected requests retain
  unknown actual billing. Do not add docs cost to the existing explicitly scoped
  `draft_and_advisor` total or change its formula and caching savings.
  The service reference multiplier covers upstream attempts, not confirmed
  billed calls; print that basis and `actual_billing=unknown`. Unknown usage
  marks `usage_status=partial`, alongside its counter. This is a reference
  overage scenario, never an unqualified invoice estimate.
- Pass `${{ secrets.CONTEXT7_API_KEY }}` only to the trusted runner; it never
  appears in OCR's environment or configuration. Preserve current artifact
  allowlist and seven-day retention. The portable `ocr-reviewer` skill describes
  optional tool use and independent limits, with no provider/model/forge pin.
  GitLab adopters reuse broker/skill and supply their own CI and publisher.

### Source evidence

Current official references (verified 2026-10-18):
[Search API](https://context7.com/docs/search-api),
[version semantics](https://context7.com/docs/api-reference/search/search-documentation-in-one-request),
[privacy](https://context7.com/docs/security/data-privacy),
[pricing](https://context7.com/plans). A public-only transport probe initialized
the hosted MCP endpoint and listed tools. One anonymous Search API request
returned JSON snippets, source links and version metadata. These are feasibility
evidence, not OCR integration or live-key acceptance proof. API schemas and
pricing do not confer permission to index private source or change account policy.

### Ownership, slices and verification

Delegation Map: the configured executor owns only broker implementation and its
focused tests. Main owns credential/data-boundary decisions, runner/workflow,
guidance, integration, publication and final proof. The broker work is separable
after this contract; main works on its runner interface in parallel. Planner,
simplifier, slice reviewer and final reviewer are read-only gate owners.

1. Broker tool and tests. Route: executor. Extend only
   `.github/scripts/ocr-review-tools.cjs` and its test file. Acceptance: synthetic
   HTTP requests prove quotas, cache, input rejection, bounds, version status,
   source filtering, cancellation and advisor independence. Commit the coherent
   integrated implementation only after main checks its seam.
2. Runner, CI and portable guidance. Route: main; critical-path coupling to
   credential isolation and cost scope. Extend `ocr-draft-review.cjs` and its
   tests, `ocr-self-update-guard.test.cjs`, `check-ocr-review.yml`,
   `.agents/skills/ocr-reviewer/SKILL.md` and `docs/ci-and-deployment.md`.
   Acceptance: runner/native-CLI fixture registers and invokes all three tools
   against synthetic services, emits sanitized counters and estimates, excludes
   all upstream keys and preserves existing CLI settings and cost formulas.
3. Integrated delivery. Main runs the existing focused OCR suites, formatting,
   staged secret/data review, and relevant static scanning. Run armed reviews
   over the committed full range and resolve findings. Push and open a draft
   PR against `v3`, then inspect CI and ordinary feedback. No app runtime or
   browser evidence is needed for this non-rendered CI extension.

Tests protect structured behavior, not instruction wording. Extend existing
synthetic fixtures; add no new framework or dependencies. Required cases include
missing key, network/HTTP/JSON failures, rate limits, invalid query/library,
concurrent quota races, sequential cache reuse, too-large/empty responses,
unverified/mismatched versions, cancellation and no content leakage. Native
qualification uses the already checksum-verified OCR 1.13.0 binary. Whole-app
hooks may skip absent host dependencies through the existing guard; required CI
remains distinct evidence. Reuse unchanged verification rather than repeating it.

| Independent risk | Obligation | Existing primary seam |
| --- | --- | --- |
| Outbound validation and credential isolation | Extend existing | `ocr-review-tools.test.cjs` and runner child-environment/native fixture |
| Result, version and cache correctness | Extend existing | `ocr-review-tools.test.cjs` synthetic HTTP contract |
| Shared quota, cancellation and failure isolation | Extend existing | `ocr-review-tools.test.cjs` concurrent requests and abort fixtures |
| Separate service accounting and honest unknowns | Extend existing | `ocr-draft-review.test.cjs` summary subprocess and native fixture |

This portfolio is feature-wide; slices add no second framework or duplicate
prose tests. Required native qualification sets
`OCR_TEST_BINARY=/private/tmp/ocr-affinity-qualification/opencodereview-darwin-arm64`
and `NODE_PATH=/Users/rschlae/Git/klicker/klicker-uzh/node_modules`, then runs
Node 24 `--test .github/scripts/ocr-draft-review.test.cjs
.github/scripts/ocr-review-tools.test.cjs .github/scripts/ocr-mistral-adapter.test.cjs
.github/scripts/ocr-self-update-guard.test.cjs`. The native integration test must
pass without a skip. A missing binary leaves delivery verification pending.

## Progress

- Status: implementation and integrated verification complete; committed-range
  simplification, risk review and final review remain before draft delivery.
- Terminal: reviewed source and draft PR against `v3`; merge/live activation later.
- Baseline: 101 focused tests passed, including non-skipped pinned-CLI proof.
- Verification: 251 integrated tests pass with no skips, including all three
  tools through pinned OCR 1.13.0, concurrent quotas and deadline/cancellation.
  Formatting, guidance links and agent-document checks pass. Opengrep reports
  no findings in the two changed runtime scripts.
- Ownership: main completed the broker after the executor returned no artifact
  and was explicitly stopped. No replacement executor was launched.
- Test delta: extended existing broker, runner and workflow seams; no new framework.
- Next action: review the complete committed implementation, resolve findings,
  then publish the draft PR. No PR exists yet.
- Packaging: one extension to the existing draft-review pipeline; no stack.
