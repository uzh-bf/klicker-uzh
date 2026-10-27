# Categorized sync changelogs and reliable description refresh

## Approval summary

The user requested a follow-up to merged [PR #6584](https://github.com/uzh-bf/klicker-uzh/pull/6584): investigate why [sync PR #6583](https://github.com/uzh-bf/klicker-uzh/pull/6583) retained its old description, fix the reconciliation gap, and organize the generated output by conventional commit category. This executable batch implements that directly requested outcome and delivers a reviewed draft PR into v3. It adds no dependency, model-generated text, GitHub permission, maintained sync pair, or manual description editing.

Use the existing release category names/order from .versionrc.js. Imported entries appear under conventional category headings; unknown or malformed headers remain visible under Other. Preserve exact subjects, links, complete history, merge-edit paths and separately identifiable additional sync commits. Put revision metadata after the changelog, omit empty sections and zero-omission footers, and retain explicit counted omissions whenever the byte limit excludes entries.

For reconciliation, distinguish the PR's identity and lifecycle metadata from actual Git ref revisions. Read the real head/target refs for the analyzed snapshots and revalidate them before updating a body; continue checking the PR's open state, same-repository identities and head/base names. Reproduce lagging PR revision metadata with synthetic API data. Record structured description outcomes and deferral reasons in the workflow logs so an advanced branch is not mistaken for a refreshed description. Historical logs lack intermediate metadata, so identify a reproducing failure mechanism without claiming an unrecorded historical observation.

Acceptance is focused regression coverage, deterministic categorized previews of the recorded real Git snapshots, appropriate source checks, configured review, and current-head CI for a draft PR. Marking ready, merging, workflow dispatch, direct live body edits and live sync repair remain withheld. There is no new material decision for the user; this is the finite source follow-up they requested.

## Execution details

### Context and evidence

- Baseline: origin/v3 at 27421631db7a7c39d80e494ee1c00489622685fc after fetch on 18 October 2026. The primary checkout is used only for inspection; preserve others' work.
- Task checkout: trees/sync-pr-changelog, reused on new branch enhance/sync-pr-changelog-categories. Previous implementation was squash merged and its remote task branch deleted. Existing ignored verification receipts remain local.
- Execution mode: standard, because the reported main identity is generic GPT-6 rather than an exact solo-allowlisted model.
- First postmerge maintenance run39125224976 actually executed merged controller code. It advanced sync PR6583 without replacing its body; sync PR6550 received an exact deterministic body with real merge edits. The logs expose actions but omit description outcomes. A subsequent GET-only dry-run successfully renders both descriptions. See the ignored live-verification receipt for detailed immutable evidence.
- GitHub's Git reference API describes branch refs as the underlying commit pointers. PR revision fields are a second view, so they must not be the sole authority for actual head/target revisions after a ref write. https://docs.github.com/en/rest/git/refs#get-a-reference
- Conventional headers allow case-insensitive type, optional scope and optional ! before the colon. Categories are a repository policy, supplied by .versionrc.js. https://www.conventionalcommits.org/en/v1.0.0/

### Contracts

1. The controller owns complete sync bodies. All generated text remains a deterministic transform of trusted category configuration and immutable Git metadata; preserve safe code spans, Git isolation and the 60000-byte UTF-8 cap.
2. Category ordering comes from the existing release configuration with duplicate sections combined; unmatched headers use Other. Keep the input topological order within each category and preserve every commit exactly once unless explicitly counted as omitted. Do not infer intent or discard merge/history records.
3. Retain the existing output evidence interface. Expose only the minimal structured classification evidence needed to verify grouping; tests protect grouping/membership and budget rather than copy or snapshots.
4. Head and target ref equality before/after analysis remain the write safety boundary. PR open state, strict pair-owned head name, base name and same-repository ownership remain mandatory. Stale PR SHA fields must not prevent publication for stable actual refs. Ref movement, closure, retargeting and repository changes must still defer without writing.
5. Use safe machine-readable reason codes for deferrals, and show description status/reason beside each pair action. Preserve per-pair analysis failure handling and never expose arbitrary error messages or credentials.
6. Load .versionrc.js relative to the trusted generator module, inside its factory/error boundary. Validate its type/section records; missing or invalid config fails description generation with the existing sanitized error result and no published placeholder. Use non-cone sparse-checkout patterns /.github/scripts/ and /.versionrc.js, and verify that actual checkout shape can load the module independent of cwd. No fetched sync-ref code is executed.

### Ownership and sequence

- Main: diagnosis, controller reconciliation/tests, workflow wiring/logging, documentation, integration, GitHub effects and final proof. Acceptance: stale PR-metadata regression passes while existing moved/closed/fork/retarget protections pass.
- One executor: settled generator grouping and focused synthetic-history coverage, limited to sync-pr-changelog.cjs and its existing test file. Acceptance: config-derived categories, unknown-header preservation, repeated identical output, whole-entry omissions and unchanged graph/path membership. No commits, forge writes, delegation or unrelated edits.
- Planner: challenge this complete frozen plan before implementation. No existing child covers this follow-up package. Parent verifies findings and retains product/authority decisions.
- Review: after each substantive committed slice, configured simplifier; risk reviewer for the ref-revalidation correction. One configured Claude integrated final review covers the complete final diff, including grouping, workflow trust and data hygiene.

Delegation map and executable slices:

| Slice | Owner and paths | Dependency and acceptance | Stop condition |
| --- | --- | --- | --- |
| Categorized generator | Executor: existing .github/scripts/sync-pr-changelog.cjs and .github/scripts/sync-pr-changelog.test.cjs only | Config contract in §Contracts6 is settled before dispatch; grouping, unknown headers, missing/invalid config, repeated bytes and aggregate budget pass | Failed classification, accounting, or isolation acceptance blocks integration |
| Canonical ref reconciliation and integration | Main: existing .github/scripts/draft-sync-prs.cjs/tests, .github/workflows/maintain-draft-sync-prs.yml, docs/ci-and-deployment.md and this new plan | Independent of generator internals; integrate settled config checkout, canonical ref/race regression and status logging | Unsafe write, unresolved trust behavior or failed checks blocks dependent delivery |
| Delivery verification | Main with configured review roles; no further maintained files planned | Full immutable diff, focused checks, read-only previews, draft PR/CI | Findings must be dispositioned; no ready transition, merge or live repair |

No new maintained source/test module is authorized; the only new committed file is this plan. Existing ignored review receipts may hold diagnostic scripts and reports.

### Verification and delivery

Use pinned Node24.21.0 and the existing host YAML/formatting dependencies for these standalone scripts; no application runtime. Extend the existing synthetic fixture with PR metadata revisions independently controlled from canonical refs throughout both reads. Prove stale head/base metadata can coexist with stable ref snapshots and still publish; retain refusal when either real ref moves while PR metadata stays frozen. Closure, head-name change, retargeting and repository changes still prevent writes. Capture workflow info logs to verify structured status/reason propagation and sanitized analysis failure. Existing repeated-run coverage must still produce zero body writes when bytes match.

Use synthetic subjects spanning feat/enhance/fix, scopes, !, case variants, combined categories, malformed headers and unknown types. Verify visible category membership against the release config, not hardcoded prose. Extend the existing byte-accounting scenario with near-limit individually fitting entries across multiple categories plus merge edits/additional commits. Reconcile omitted whole entries and paths, retain merge-edit allocation priority, and bound the complete body including accumulated headings/separators. Missing/invalid config must fail without a body or raw exception.

Test portfolio: extend existing controller race/ownership tests for independent metadata/ref revisions; extend existing workflow entrypoint tests for checkout/config and status/reason propagation; extend existing synthetic-history tests for categories and aggregate budget. Use a focused temporary trusted sparse-checkout smoke for actual loading. Documentation changes require no content assertions or new test.

Run the controller/generator/ancestry/event/direct-script suites, applicable formatting, diff checks and staged secret/data inspection. Preview the recorded real snapshots read-only and compare repeated body bytes. Run focused Opengrep when available. Preserve the original live-verification evidence; do not overwrite existing PR bodies to demonstrate the patch.

Commit the plan, then coherent implementation slices. Push normally to the task branch and create a draft PR into v3, attach it to the chat, and monitor applicable CI/ordinary feedback. Do not trigger the hosted ready-only final review while draft. Configured Claude source review remains the integrated final gate. Report source/CI separately from activation and any later automated live acceptance.

## Progress

Planner approved the revised contract after two rounds. The plan was committed before implementation. Controller slice4ec31ad3b4 uses canonical ref revisions and preserves metadata identity/lifecycle/ref movement guards; the frozen-metadata regression failed baseline and passes the correction. All44controller/ancestry/event/direct-script checks pass on pinned Node24.21.0. Opengrep reports only the unchanged fixed-pair RegExp finding. The simplifier found no useful reduction; the bounded risk review passes with no findings.

Executor01a14f21-7426-7893-a3a7-e16892f44e89 returned a terminal handback without code after convergence; main then took ownership, implemented the generator and three consequential tests, and verified all51focused cases on pinned Node24.21.0. Category configuration is loaded relative to the trusted module within the factory boundary. Grouping, aggregate UTF-8 accounting, missing/invalid config, original graph/path/isolation behavior and repeated bodies pass. No dependency or application runtime was added.

[Draft PR #6590](https://github.com/uzh-bf/klicker-uzh/pull/6590) delivers the implementation. Generator simplification found no useful reduction. Both recorded-history previews repeat identical bytes, and a real temporary sparse checkout loads the trusted config outside the checkout cwd. Claude's integrated review accepted the ref/ownership/trust/category/budget contracts and found one omission-placement issue plus a dead test stub. The correction moves the aggregate imported omission notice before category headings and removes the obsolete branch API mock; the existing aggregate scenario now protects that scope. Focused correction review and current-head hosted CI/ordinary feedback remain the delivery gates. The PR stays draft. Review receipts remain in ignored project/_local/reviews; terminal forge evidence may be recorded there and in the PR body without another source-only metadata push. Merge, readiness changes and live workflow/body edits remain withheld.

Claude's focused correction passes, and all eight required checks pass on e8eb64d9b4. The completed automatic draft review identified the adjacent stale-list revision path in branch advancement and previews. The final bounded correction reads their canonical head too, extends the same frozen-metadata scenario across list/get reads, proves a resolution head containing source is preserved without a rejected ref write, and makes missing mock refs return404. This completes the same canonical-ref contract; it does not establish a historical422, since the observed first maintenance run succeeded. All51focused checks pass again. A bounded independent extension review and fresh final-head CI remain; no further general review of unchanged generator/config code is needed. Source/merge authority boundaries are unchanged.
