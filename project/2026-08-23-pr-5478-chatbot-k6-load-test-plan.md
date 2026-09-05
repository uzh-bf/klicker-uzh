# Chatbot k6 load-test package — PR #5478

## Goal

Publish the reusable Klicker chatbot HTTP/authenticated-turn k6 suite as an
independent PR against `v3`, without carrying the closed provisioner or
lecturer-demo work.

## Plan identity

- Branch: `rs/chatbot-k6-load-test`
- Target: `v3`
- PR: [#5478](https://github.com/uzh-bf/klicker-uzh/pull/5478)
- Current reviewed head: `3c44b9675`

## Scope and authority

- Include only `util/load-test/chatbot-http.js`, `util/load-test/chatbot-auth.js`,
  `util/load-test/chatbot-turn.js`, and the shared
  `util/load-test/chatbot-login.js` module, plus this plan artifact.
- Exclude provisioner, activation, database, lecturer-demo, runtime, dependency,
  lockfile, and legacy `util/load-test/k6.js` changes.
- Authorized: create this worktree and branch, make bounded script/plan edits,
  run local static and k6 inspection checks, commit, push the feature branch,
  and open or update the PR against `v3`.
- Withheld: live k6 runs, Infisical reads or writes, real credential or secret
  access, production/staging login or chatbot traffic, database/provider
  traffic, deployment, merge, and lecturer communication. Normal login updates
  `Participant.lastLoginAt` once per run, and a chat-turn run persists its
  synthetic conversation; those effects require a separately authorized live
  canary.
- Boundary owner: main session. Terminal: reviewed PR package published; live
  k6 traffic, merge, deployment, and lecturer communication remain withheld.
- The prior base-movement pause was triggered when `v3` moved from
  `d4303516a8d4863b45d81c372f5f0023548f8b4a` and was resolved by the approved
  merge of current `v3` at `8e8009c56`. Pause again if the target moves before
  the next publication, the isolated patch no longer applies, or safety
  hardening requires paths outside the four k6 paths and this plan.

## Evidence and decision

- Closed provisioner PR #5406 contains nineteen source-only commits relative to
  current `v3`; all non-k6 changes are provisioner, activation, lecturer-demo,
  or related evidence/planning work.
- Commit `095fe8bfc` adds exactly the three k6 scripts (242 executable lines).
- The scripts need fail-closed controls before publication: explicit target
  selection, explicit production opt-in, explicit chat-turn side-effect
  acknowledgement, strict turn-count validation, and corrected comments.

## Normal-login authentication contract

- The authenticated scripts support either the existing
  `KLICKER_PARTICIPANT_TOKEN` mode or a normal participant login. The modes
  cannot be mixed.
- Normal login uses the persisted `LoginParticipant` operation through the
  target API's `/api/graphql` endpoint. It requires runtime-injected
  `KLICKER_PARTICIPANT_USERNAME_OR_EMAIL`, `KLICKER_PARTICIPANT_PASSWORD`,
  `KLICKER_API_URL`, and `KLICKER_ALLOW_LOGIN=true`.
- Login is limited to the known origin pairs
  `chat.klicker.stg.df-app.ch` + `api.klicker.stg.df-app.ch` and
  `chat.klicker.uzh.ch` + `backend-sls.klicker.uzh.ch`. HTTPS, canonical
  origins, production opt-in, and the existing target guards remain required.
- The k6 `setup()` function retains only the issued `participant_token` in
  memory and passes it to VUs. Response bodies, credentials, token values,
  questions, and answers are not logged or persisted by the suite.
- A normal login is not read-only: the application updates `lastLoginAt`. A
  successful Tutor turn additionally persists thread and message records and
  can invoke retrieval and the provider. Static checks cannot prove those
  runtime effects.

## Delegation map

| Slice | Owner | Acceptance |
| --- | --- | --- |
| S1 isolated branch and plan | main | Fresh worktree at pinned `v3`; plan committed first |
| S2 k6 suite extraction and safety hardening | main | The original three script paths changed; negative guards fail before network execution |
| S3 integrated review | final-reviewer | Correctness, security, maintainability, and boundary findings dispositioned |
| S4 publication | main | Feature branch pushed and draft PR targets `v3`; no merge |
| S5 normal-login amendment | main | Shared login module and two authenticated scripts use persisted login with explicit acknowledgements |
| S6 authenticated static verification | main | Positive/negative k6 inspections, archive guard, repository checks, and exact four-path diff |

## Test portfolio

| Risk | Obligation | Primary seam | Evidence |
| --- | --- | --- | --- |
| Script syntax/options | extend existing | k6 inspection | `k6 inspect --execution-requirements` for all three entry scripts, including the shared login module |
| Safety guards | add new | preflight validation | missing target/auth/opt-in/ack/model/invalid turns and target mismatches fail before network |
| Formatting/diff hygiene | extend existing | repository checks | formatter check and `git diff --check` |
| Live behavior | none in this PR | external runtime | intentionally withheld; use separately authorized canary package |

## Progress

- S1: complete — isolated branch created from pinned remote `v3`; plan commit
  `d7556715a`.
- S2: complete — source extraction commit `59941bcec` and safety hardening
  commit `1fe2afdcc`; only the three k6 scripts changed.
- Verification: Biome check, repository formatting/lint/sync checks, gitleaks,
  `git diff --check`, three positive `k6 inspect --execution-requirements`
  runs, and six negative guard inspections passed. The first clean-worktree
  check attempt failed because generated package outputs were absent; local
  package builds generated those ignored outputs, after which the normal
  pre-commit hook passed.
- Review correction: final review found three safety defects. Commit
  `00b396166` enforces the request-path turn cap against CLI iteration
  overrides, normalizes origin-only production target forms, and rejects
  whitespace-only identifiers/models.
- Verification after correction: four positive and eleven negative k6
  inspections passed; `k6 archive -u 1 -i 100` showed the CLI override and
  preserved the hard-cap guard in the archive; focused Biome, diff checks,
  gitleaks, and the normal repository pre-commit hook passed.
- Review correction: the second review found two transport/target variants.
  Commit `5efedce23` requires production opt-in for every normalized
  production-host form and requires HTTPS for authenticated scripts.
- Verification after the second correction: four positive and fifteen
  negative k6 inspections passed, including HTTP production-host, noncanonical
  port, and plaintext-authenticated-target guards; the archive hard-cap check,
  focused Biome, diff checks, gitleaks, and the normal repository pre-commit
  hook passed.
- Review correction: the third review found redirect following and Unicode
  production-host aliases. Commit `40d883e20` sets `redirects: 0` for
  authenticated requests and rejects non-ASCII DNS hostnames in all three
  scripts.
- Verification after the third correction: four positive and twenty negative
  k6 inspections passed, including Unicode-dot production aliases in all three
  scripts; the archive hard-cap check, focused Biome, diff checks, gitleaks,
  and the normal repository pre-commit hook passed. The hook reported only the
  existing Node 26 versus Node 24 engine warning and unrelated deprecation
  warnings.
- Review correction: the fourth review found raw chatbot-ID interpolation in
  request paths. Commit `1616335d1` requires canonical UUID-shaped IDs in all
  three scripts before endpoint construction.
- Verification after the fourth correction: four positive and twenty-three
  negative k6 inspections passed, including path-bearing IDs for anonymous,
  authenticated, and chat-turn scripts; the archive hard-cap check, focused
  Biome, diff checks, gitleaks, and the normal repository pre-commit hook
  passed. The hook again reported only the existing Node 26 versus Node 24
  engine warning and unrelated deprecation warnings.
- Review correction: the fifth review found percent-encoded Unicode production
  host aliases. Commit `538f4e630` rejects percent-encoded authority
  characters before host normalization in all three scripts.
- Verification after the fifth correction: four positive regression
  inspections and three percent-encoded production-host negative inspections
  passed; the archive hard-cap check and focused Biome check passed. No live
  request was made.
- S3: complete — final-reviewer approved exact range
  `f58986faa8cfa4ff78d20a1ebeb1666473343d38..3196907e3` with no findings.
- S4: complete — branch head `86f51239b` is pushed as draft PR #5478 against
  `v3`; host read-back confirms the four expected paths and 15 branch commits.
  Required CI checks are pending; merge remains withheld.
- Fresh host read-back for this continuation reports remote `v3` at
  `d4303516a8d4863b45d81c372f5f0023548f8b4a`. At the recorded branch head
  `f7e1fa8c5e73975cf43365156a033d60eb25b7bc`, the branch was four commits
  behind and sixteen commits ahead of that ref, with merge-base
  `f58986faa8cfa4ff78d20a1ebeb1666473343d38`; the current branch adds the
  normal-login commit without a rebase or reset. A later merge or promotion
  decision must account for that divergence.
- S5: complete — the native planner approved a shared `chatbot-login.js`
  design with the persistence concern recorded above. The implementation is
  limited to the shared module plus the two authenticated scripts; the
  anonymous script remains unchanged.
- S6: complete — both authenticated entry scripts passed direct-token and
  normal-login `k6 inspect --execution-requirements` checks with dummy values;
  PRD login checks passed with the explicit production acknowledgement. Ten
  negative guard inspections failed closed, including mixed/partial auth,
  missing login acknowledgement, HTTP/API/path errors, target mismatch, PRD
  opt-in, and malformed chatbot ID. The archive preserved the turn cap and
  imported login module without embedding environment values. Biome, Prettier,
  `git diff --check`, the anonymous HTTP inspection, and persisted-operation
  hash checks passed. No live login, chatbot, provider, database, or Infisical
  action is part of this package; runtime proof remains a separate approval
  gate.
- S7: complete — the configured native simplifier and slice-reviewer routes
  failed before inspection with the encrypted-task/provider error. A native
  Sol fallback reviewed both lenses on the exact committed range; it found no
  code issue and one stale branch-ancestry sentence, which is corrected above.
- S8: complete — the native final reviewer approved exact range
  `f7e1fa8c5e73975cf43365156a033d60eb25b7bc..519ad5a56` when `519ad5a56` was
  HEAD, with no findings. Static login setup and cookie acceptance remain the
  only runtime uncertainty; live login and chat execution stay separately
  gated.
- S9: complete — reviewed branch head `d6979b613` is pushed to the existing
  feature branch and draft PR #5478 against `v3` is updated with the whole
  five-path package. PR CI is pending on that head; merge, deployment, and live
  k6 traffic remain withheld.
- S10: complete — fresh remote read-back found `v3` at `ee5712399` and the
  feature branch at `3ddec2cd7`; the approved merge commit `8e8009c56` brings
  the branch to zero commits behind and twenty-four commits ahead. The branch
  push succeeded and PR [#5478](https://github.com/uzh-bf/klicker-uzh/pull/5478)
  now tracks `8e8009c56` as an open, non-draft PR. Focused `k6 inspect
  --execution-requirements`, Biome, and `git diff --check` verification passed
  after the rebaseline. The preserved uncommitted `AGENTS.md` documentation is
  outside this package and is not staged.
- S11: complete — plan reconciliation commit `245f18464` is pushed at the
  current feature head. PR CI completed with all non-skipped checks passing;
  filtered jobs are skipped only after their status gates pass. The current
  target is `v3` at `ee5712399`, and the branch is zero commits behind and
  twenty-nine commits ahead. The exact target diff remains the five listed
  package paths.
- S12: complete — Sol's review of `b9a7cbdf9` found one high-severity
  credential-boundary issue and four follow-up concerns. The token-mode issue
  is fixed by `b9a7cbdf9`, which restricts authenticated requests to canonical
  HTTPS STG/PRD chat origins. Commit `85ef8af` fixes the false-green turn
  threshold, covers every supplied chatbot in smoke mode, and repairs both
  normal-login examples. Positive and negative k6 inspections, including
  three-chatbot smoke coverage and an unknown-host token guard, passed; the
  repository pre-commit checks also passed. A final Sol review of the exact
  post-correction range remains required.
- S13: complete — Sol final-reviewer reviewed the exact
  `ee5712399fcda479422a61b78004a1cb3b0636e9..274f50dde` range across the five
  package paths and returned DONE with no findings. The report is preserved at
  `project/_local/reviews/2026-08-23-chatbot-k6-final-review.md`. Final PR CI
  on `274f50dde` passed all non-skipped checks; filtered jobs were skipped only
  after their status gates passed.
- S14: complete — the whole-branch PR description was updated and read back on
  PR #5478. It covers the five-path diff, 671 substantive script lines, all
  meaningful branch slices, security/privacy boundaries, current-head static
  evidence, Sol's final review, and the withheld live-runtime gate. CI on the
  latest published head `ec66a2e34` passed all non-skipped checks; filtered jobs
  were skipped only after their status gates passed.
- S15: complete — final plan publication moved the branch to `38b940e28`,
  thirty-one commits ahead and zero behind `v3`. The host read-back confirms
  PR #5478 is open, non-draft, and clean, with all required checks passing and
  only status-gated filtered jobs skipped.
- S16: complete — the final host read-back confirms head `194a3a5cb`, zero
  commits behind and thirty-two ahead of `v3`, with all required checks
  passing. This is a bookkeeping-only plan update; no source or runtime
  behavior changed.
- S17: complete — the final publication read-back confirms head `3c44b9675`,
  zero commits behind and thirty-three ahead of `v3`, with all required checks
  passing. This is a bookkeeping-only plan update; no source or runtime
  behavior changed.
- Remaining: live login, chatbot/provider traffic, merge, deployment, and
  lecturer communication remain withheld.
