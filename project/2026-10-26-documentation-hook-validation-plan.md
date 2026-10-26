# Documentation-only Git hook validation

## Approval summary

The approved delivery-workflow design includes a conservative local validation
path for Markdown changes. Existing hooks currently require an application
container even when only a planning document changed. Extend the existing
classifier and hook dispatcher so proven documentation changes run applicable
host checks. Code, policy changes and uncertain Git inputs retain full validation.

This is package 2 of the design approved on 26 October 2026. The shared observer
and close-out skill package is delivered separately. This package does not change
Writing Coach behavior, branch protections, CI selection or secrets policy.
Success requires exact staged/outgoing content checks, preserved identity and
secret scans, conservative fallbacks, and passing focused regression tests.

Approval covers source implementation, tests, local commits, normal task-branch
push and draft PR delivery. Merge, deployment, protected/default pushes and
destructive cleanup remain separately gated. Terminal: reviewed source and
applicable verification on a held candidate; report concrete delivery blockers.

## Execution details

- Repository: KlickerUZH; task branch
  `enhance/documentation-hook-validation`; baseline `c86162dd78` on `v3-ai`.
- Main owns integration, authority and final proof. One executor owns the
  classifier, dispatcher, document checker and hook-entrypoint changes.
- No affected product primitive. No dependency or data-model change.
- Preserve the one documentation-path classifier. Add a narrower local-hook
  decision for regular non-executable Markdown additions/modifications only.
- Pre-commit validates staged blobs and the alternate index. Working content
  cannot substitute for the index. Unknown policy equivalence keeps full checks.
- Pre-push captures ref stdin once and replays identical content to the identity
  guard and dispatcher. Initially narrow only one linear fast-forward branch
  update at checked-out HEAD with a known old remote object and matching policy.
  Every outgoing transition must qualify. Earlier code or a reverted code change
  cannot hide behind the final docs diff. Other refs and uncertain history keep
  the existing full path.
- Extend the removed-document checker using its one forbidden-path list.
  Preserve disk checks and add exact staged/outgoing inventories.
- Parse every qualifying Markdown blob with installed Prettier, including ignored
  files; apply formatting policy only where configured. Run whitespace and
  applicable document-policy checks. Missing tools remain a blocker.
- Mandatory scans are preserved. No hook bypass or automatic tool installation.

## Test portfolio

Extend classifier and hook tests for staged/working divergence, alternate index,
ignored Markdown, unsafe modes, changed policy, malformed refs and documentation
tails after code. Exercise the actual pre-push entrypoint for stdin replay and
identity-failure propagation. Use synthetic temporary repositories and installed
tooling; tests must assert behavior rather than document wording.

## Sequence and acceptance

1. Implement staged documentation dispatch and exact document-policy checks.
2. Add outgoing-range dispatch and entrypoint stdin replay.
3. Run focused existing/new contract tests, inspect full diff and complete review.
4. Qualify one candidate with required repository checks and draft delivery.
   Keep CI results in the final response rather than another receipt commit.

Rollback is an ordinary source revert restoring prior full validation. Do not
delete retained runtime data or worktrees.

## Progress

Source implementation is complete in the task worktree. The executor delivered
the seven intended paths; main integration preserved existing source formatting,
removed unused public exports and a redundant wrapper, and made the pre-push
script compatible with Husky's `sh -e` launch path.

Focused classifier, dispatcher and identity tests passed all 74 checks. Biome,
shell syntax, removed-document policy and diff checks passed. Focused Opengrep
reported no findings. These tests use synthetic Git histories and a mocked
runtime command; they do not prove the full application check/build path.

The user approved the exact local `db` runtime and dotfiles default-branch push
after the initial automatic-review rejection. The shared package is published.
Runtime bootstrap, mandatory full validation, committed-source reviews and draft
delivery of this package are pending. No mandatory hook is waived.

Execution mode is standard. Main owns runtime verification, integration and
publication. The planned simplifier and risk reviewer inspect the committed
implementation, followed by the integrated final reviewer. The package is one
coherent extension to Git-hook validation, with about 1,500 substantive changed
lines including its regression tests; it stays in one task-branch draft.

Stop and verify the exact runtime after its final dependent check. A failed full
check blocks publication while in-scope source diagnosis continues. Terminal
run evidence belongs in the ignored review record and final response, without
another tracked receipt-only commit.
