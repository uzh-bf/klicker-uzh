# Chatbot k6 load-test package

## Goal

Publish the reusable Klicker chatbot HTTP/authenticated-turn k6 suite as an
independent draft PR against `v3`, without carrying the closed provisioner or
lecturer-demo work.

## Scope and authority

- Include only `util/load-test/chatbot-http.js`, `util/load-test/chatbot-auth.js`,
  and `util/load-test/chatbot-turn.js`, plus this plan artifact.
- Exclude provisioner, activation, database, lecturer-demo, runtime, dependency,
  lockfile, and legacy `util/load-test/k6.js` changes.
- Authorized: create this worktree and branch, make bounded script/plan edits,
  run local static and k6 inspection checks, commit, push the feature branch,
  and open a draft PR against `v3`.
- Withheld: live k6 runs, credential or secret access, production/staging
  traffic, database writes, provider calls, deployment, merge, and lecturer
  communication.
- Boundary owner: main session. Terminal: reviewed draft PR published.
- Pause if remote `v3` moves from `f58986faa8cfa4ff78d20a1ebeb1666473343d38`,
  the isolated patch no longer applies, or safety hardening requires paths
  outside the three scripts and this plan.

## Evidence and decision

- Closed provisioner PR #5406 contains nineteen source-only commits relative to
  current `v3`; all non-k6 changes are provisioner, activation, lecturer-demo,
  or related evidence/planning work.
- Commit `095fe8bfc` adds exactly the three k6 scripts (242 executable lines).
- The scripts need fail-closed controls before publication: explicit target
  selection, explicit production opt-in, explicit chat-turn side-effect
  acknowledgement, strict turn-count validation, and corrected comments.

## Delegation map

| Slice | Owner | Acceptance |
| --- | --- | --- |
| S1 isolated branch and plan | main | Fresh worktree at pinned `v3`; plan committed first |
| S2 k6 suite extraction and safety hardening | main | Exactly three script paths changed; negative guards fail before network execution |
| S3 integrated review | final-reviewer | Correctness, security, maintainability, and boundary findings dispositioned |
| S4 publication | main | Feature branch pushed and draft PR targets `v3`; no merge |

## Test portfolio

| Risk | Obligation | Primary seam | Evidence |
| --- | --- | --- | --- |
| Script syntax/options | extend existing | k6 inspection | `k6 inspect --execution-requirements` for all three scripts |
| Safety guards | add new | preflight validation | missing target/opt-in/token/ack/model/invalid turns fail before network |
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
- S4: in progress — push and open the reviewed draft PR; merge remains
  withheld.
