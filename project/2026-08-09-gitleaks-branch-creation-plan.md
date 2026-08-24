# Gitleaks branch-creation scan hardening

Status: COMPLETE — final gates passed; branch unpushed
Date: 2026-08-09
Branch: rs/gitleaks-branch-creation → target v3
Owner: Roland Schlaefli
Related history: project/2026-07-19-biome-knip-repo-quality.md

## Goal

Make the blocking Gitleaks workflow scan every commit introduced by the
configured `v3`/`v3*` branch-creation push events, including when GitHub
provides an all-zero `github.event.before` SHA. Pull requests on other branch
names remain covered by the existing pull-request trigger.

## Problem

The current workflow falls back to --max-count=1 HEAD when
github.event.before is all zeros. A new branch containing multiple commits can
therefore hide a secret in an earlier commit when its tip is clean.

## Evidence

- Current implementation: .github/workflows/check-gitleaks.yml:58-62.
- The push trigger is limited to `v3` and `v3*`; pull requests are covered
  separately by the existing pull-request trigger.
- A read-only Sol review of the merged hardening commit verified this as a
  high-confidence security finding.
- The current workflow already has full history, checksum verification,
  redaction, narrow allowlists, and separate push/PR SHA inputs.
- The current v3 tooling versions remain Biome 2.5.2 and Knip 6.24.0;
  version refresh is deliberately outside this branch.

## Decision

Use the repository default branch as the safe fallback base:

1. On a normal push or pull request, scan the existing base-to-head range.
2. When before is all zeros, fetch the default branch and compute
   git merge-base origin/<default-branch> HEAD.
3. Scan that merge-base-to-head range.
4. Fail closed if the default branch or merge base cannot be resolved.

Do not use a full-history fallback: it would re-report unrelated historical
findings. Do not retain the tip-only fallback.

## Non-goals

- No Biome or Knip ratchet work.
- No dependency version refresh.
- No Playwright or service-container changes.
- No secret rotation, deployment, merge, or PR publication in this slice.

## Slice 1 — branch-creation range fallback

### Do

- Update .github/workflows/check-gitleaks.yml to resolve the effective base
  SHA through the default-branch merge base when before is all zeros.
- Update docs/ci-and-deployment.md to describe introduced-commit scanning and
  the all-zero merge-base fallback instead of calling the workflow full-tree.
- Preserve checksum verification, redaction, narrow allowlists, PR range
  handling, push range handling, and read-only permissions.
- Update this plan's Progress section with the verification evidence.

### Check

- Parse the changed workflow and run shell syntax validation.
- Use a disposable two-commit Git fixture whose first commit contains a
  deliberate fake finding and whose tip is clean; exercise the all-zero
  fallback and confirm the earlier commit is included.
- Use negative fixtures with an unavailable default-branch ref and with no
  merge base; both must make the scan step exit nonzero.
- Run Gitleaks on the current tree and the normal introduced-commit range.
- Run repository formatting/diff checks for the changed workflow, wiki page,
  and plan.
- Review the final diff for secrets, personal data, and unrelated changes.

### Commit

ci(security): scan full branch-creation commit ranges

## Review routing

- Planning stage: configured Codex Sol reviewer, read-only, exact plan draft.
- Integrated outcome: configured Codex Sol reviewer after verification.
- Security lens: bounded security-review on the final workflow change.
- Maintainability lens: thermo-nuclear-code-quality-review on the exact final
  range.

## Progress

- 2026-08-09: Fresh branch created from current origin/v3. Migration PRs
  #5186 and #5285 are merged. The post-merge Gitleaks gap is the only scope
  in this slice; staging secret rotation was verified in the earlier handoff
  and is not reverified by this repository-only slice.
- 2026-08-09: Sol planning review completed. Integrated required negative
  fixtures, the maintainability gate, the affected wiki update, and
  trigger-accurate acceptance language; retained the default-branch merge-base
  decision and rejected tip-only and full-history fallbacks.
- 2026-08-09: Plan committed as 8bd315e27. Workflow YAML and shell syntax
  parsed successfully; Prettier passed for the workflow, wiki, and plan.
- 2026-08-09: Disposable fixture passed: the all-zero fallback detected a
  finding in an earlier commit across two commits while the tip-only control
  passed; unavailable default branch and missing merge base both failed closed.
- 2026-08-09: Gitleaks passed on the current tree and the final rebased
  introduced range origin/v3..01f98a8b2.
- 2026-08-09: Bounded security and maintainability reviews passed. Sol's final
  review found only the stale pre-rebase plan commit reference; it was
  corrected here without changing implementation behavior.

## Finish state

The slice is complete when the workflow no longer has a tip-only all-zero
fallback, the disposable positive and negative fixtures prove complete and
fail-closed range resolution, the CI wiki page matches the behavior, focused
local checks pass, the final Sol/security/maintainability reviews are
addressed, and the branch is committed. Push and PR publication remain
separate user-authorized actions.
