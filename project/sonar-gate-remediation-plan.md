# Sonar finding remediation

## Approval summary

The user approved preparing one draft PR against `v3-ai` to address the current Sonar reliability and security findings. This executable batch validates each reported finding against the exact source and its callers, corrects proven defects and bounded CI executable-resolution risks, and records supported analyzer mismatches without changing their issue states. Application behavior, the existing applied SQL migration, canonical hash ordering, review budgets, permissions and deployment controls stay intact. No new dependencies are planned.

Completion is a draft containing the smallest verified source corrections, focused native checks, a complete finding assessment, and integrated review. Sonar issue dispositions, readiness, merge, rollout and production release remain separate human actions. A draft does not establish a green branch quality gate.

## Execution details

Baseline is `ee0d01f15fcc690edd8d1b6a454a11f7aba31c27`. The target is `v3-ai`; the task worktree is `trees/sonar-gate-remediation`, branch `fix/sonar-gate-remediation`. Execution mode is standard. The existing `project/` root holds public source artifacts; runtime and detailed analysis receipts remain in the existing ignored release qualification directory.

1. Main validates reported executable-path and installer findings in `.github/scripts/{sync-ancestry-guard,sync-pr-changelog,ocr-draft-review,ocr-review-tools,install-patched-ocr}.cjs` and `.github/scripts/final-ai-stack-review.js`, plus the clear-text finding in `util/test-dev-runtime.sh`. A read-only mapper assesses only the reported sort and parser regions and their direct tests. No broad security assessment is included.
2. Prepare the smallest source correction for verified risks. Use `/usr/bin/git` for affected Git callers on Linux CI and macOS, preserving arguments and all other environment contracts. For the OCR builder, resolve pinned Go from absolute `RUNNER_TOOL_CACHE/go/1.26.9/<process.arch>/bin/go`, matching the pinned setup-go cache layout; reject relative cache roots. Outside Actions, use fixed system Go locations (`/usr/local/go/bin/go` on Linux, `/opt/homebrew/bin/go` on arm64 macOS and `/usr/local/bin/go` on Intel macOS). Keep version verification after selection, and use fixed `/usr/bin/curl`, `/usr/bin/tar`, `/usr/bin/patch`; child PATH contains only the selected Go bin and `/usr/bin:/bin`. Preserve archive checksum, patch identity and Go build/test arguments. Draft OCR moves its same pinned npm install into explicit `${RUNNER_TEMP}/draft-ocr`; source invokes its absolute `bin/ocr` path, preserving the exported API's existing absolute executable override for tests. Missing binaries fail closed. No new helper is planned. Add `.github/workflows/check-ocr-review.yml` to the exact implementation paths; no permissions or triggers change. Version checks remain identity checks, never initial trust proof. Unsupported findings remain unresolved.
3. Preserve canonical UTF-16 key order, exact hash identity, key-set validation and existing review tool request budgets. Preserve the migration unchanged. Clarify ambiguous parser behavior only after reproducing or bounding the reported issue. Keep source corrections separate from unsupported suppression or risk acceptance.
4. Run pure focused checks using pinned Node 24.21.0 in an offline ephemeral container. Suites creating synthetic Git repositories run on host Node 24.21.0 to keep all Git on the host; borrow only the existing pinned `yaml` module read-only from the previous task toolchain through NODE_PATH, with no install or application dependencies. No application server is needed. Verify changed executable callers with existing synthetic review/Git fixtures and poisoned-PATH regressions when applicable. Check formatting, staged secrets and personal/real-environment data, exact diff scope, and normal hook equivalence before commits.
5. Main integrates the complete package, verifies all reported findings have a reasoned disposition, then obtains one complete final review after local verification. Use normal non-force task commits/pushes and create a draft PR with current evidence and remaining limitations. Do not mark ready or merge. No recurring watcher is created.

## Verification

A malicious executable earlier in inherited PATH must not replace the intended system Git command. Existing synthetic review, topology, changelog and ancestry suites must preserve their success and failure contracts. Existing deterministic hash and protocol fixtures must remain valid. Installer version, checksum, patch and build arguments remain pinned. The applied SQL file must remain byte-identical to baseline. No Sonar credentials, rules, exclusions, thresholds or issue states are changed.

## Progress

Approved draft preparation; source assessment in progress. No implementation changes yet.

## Finding inventory and ownership

All inventory rows refer to baseline `ee0d01f15fcc690edd8d1b6a454a11f7aba31c27`; rule/location pairs distinguish every reported instance. Main verifies the assessment and disposition of all rows.

| Paths and rule locations | Instances | Assessment owner and acceptance |
| --- | ---: | --- |
| `.github/scripts/sync-ancestry-guard.cjs` S4036:22,72; `sync-pr-changelog.cjs` S4036:186; `ocr-review-tools.cjs` S4036:128; `ocr-draft-review.cjs` S4036:336,680,715; `final-ai-stack-review.js` S4036:2004 | 8 | Main; fixed Git lookup with poisoned-PATH synthetic regression. OCR selection retains its trusted workflow contract and needs separately supported disposition. |
| `.github/scripts/install-patched-ocr.cjs` S4036:58, S8705:52, S8707:66,67,84,119,125, S8701:113 | 8 | Main; trace fixed workflow arguments, source/archive checksum, pinned Go and patch. Do not claim a full local Go build from synthetic checks; current hosted CI must execute changed installer qualification if installer source changes. |
| `.github/scripts/playwright-route.cjs` S2871:46,47; `warpbuild-admission.cjs` S2871:36,37,67 twice,335 twice; `util/warpbuild-admission-server.cjs` S2871:125,126; `ocr-mistral-adapter.cjs` S2871:462 | 11 | Mapper Pasteur source assessment, main decision; preserve key-set and multiset behavior and UTF-16 canonical identity. Explicit code-unit comparator is permitted only for canonical hashing; other intentional sorts remain documented without source churn. |
| `.github/scripts/ocr-review-tools.cjs` S5850:123 and S9383:956 | 2 | Mapper assessment, main implementation; retain path rejection meaning and fix rejected finalizer cleanup without unhandled rejection. |
| `util/test-dev-runtime.sh` S5332:353 | 1 | Main; synthetic local Blob endpoint fixture only, no real transport change. |
| `packages/prisma/src/prisma/schema/migrations/20261013120000_ai_tier_from_cost_center/migration.sql` NullComparison:17 | 1 | Main; PostgreSQL empty-string predicate, preserve exact baseline blob. |

## Slices and delegation map

- Main owns bounded executable lookup and promise cleanup implementation, their integrated tests, all effects, public assessment and draft delivery. The risk is coupled to trusted workflow callers, so security decisions remain in main. Slice acceptance is existing review/Git suites plus poisoned-PATH and rejected-response cleanup regressions. Review committed corrections through one simplifier and one security slice review before final integration.
- Read-only mapper Pasteur (`01a16d85-43bc-7de2-8a51-6131b7a36a4c`) owns only sort/parser assessment; completed without edits. Main incorporates verified results. Unchanged sorting protocols need no worker or duplicate discovery.
- Main owns integration and one final package review after focused verification. Missing dependencies block only the affected check claim. A required migration, hash protocol, suppression, issue-state, broader security or rollout change stops that dependent branch for human authority.

## Test portfolio

| Risk | Choice and acceptance |
| --- | --- |
| Git executable substitution | Extend existing `sync-ancestry-guard.test.cjs` and `sync-pr-changelog.test.cjs` with malicious PATH executable rejection; run these suites on host Node 24.21.0. Existing tools, draft-review and stack-review synthetic Git fixtures protect the other callers. Extend `final-ai-review.test.js` with a child-process poisoned-PATH Go regression and relative tool-cache rejection. Existing draft-review fixture verifies the new absolute default installer path, in addition to explicit override compatibility. The builder itself runs in hosted Check CI after push; offline source checks do not substitute for it. |
| Rejected response cleanup | Extend existing `ocr-review-tools.test.cjs`; a controlled response failure must not emit unhandled rejection and must allow close. Existing cancellation/budget tests continue. |
| Canonical identity / key sets | No new test unless source changes. Existing `ocr-mistral-adapter.test.cjs`, `playwright-route.test.cjs`, `warpbuild-admission.test.cjs`, and server tests retain acceptance. Canonical comparator remains unchanged; no new hash test is needed. |
| Secret-path regex | No new test unless source correction is justified; existing tools rejection cases remain applicable. Any grouping-only clarification must keep all boundaries. |
| Toolchain/installer | Existing version/checksum tests in `final-ai-review.test.js`, workflow caller inspection and unchanged source identity. No full local Go build claim. Hosted Check CI must qualify the changed installer with actual Go 1.26.9, pinned archive and patch; local tests protect path selection without downloading or building Go. |
| Applied SQL and local HTTP fixture | No new tests; byte-compare SQL and inspect exact synthetic fixture caller. |

Planner round 1 REVISE: accepted all five findings. Added complete inventory/ownership, exact executable selection, host Git verification, pinned prerequisite source, test portfolio and bounded slice gates. No new authority requested.

Pre-implementation caller evidence: official pinned actions/setup-go source caches tool name `go` by exact version and architecture and adds its bin directory. Modern Go does not receive GOROOT from this action. The draft OCR workflow already installs exactly npm package 1.13.0; the new explicit prefix fixes its location without changing the package or permissions.

The companion `project/sonar-gate-remediation-findings.md` contains the per-instance source assessment. It is source-only and adds no runtime or environment observations.
