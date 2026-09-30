---
name: klicker-dependency-overrides
description: Audit, add, or drop a pnpm override in the KlickerUZH workspace. Use when an image scan or advisory names a transitive dependency, when pnpm fails with ERR_PNPM_VERIFY_DEPS_BEFORE_RUN or a lockfile/manifest specifier mismatch for an overridden package, when an override may be stale after a dependency bump, or when reviewing pnpm-workspace.yaml overrides and minimumReleaseAge entries.
---

# KlickerUZH Dependency Overrides

Every entry in the `overrides` block of `pnpm-workspace.yaml` is a standing claim: something in the locked graph would otherwise resolve below a patched release, or a line is pinned for lockstep or consolidation. The audit in step 1 tests that claim against the lockfile and the registry; the remaining steps add, drop, and repair entries.

Three mechanics decide every step:

- pnpm resolves a dependency range first, then swaps in the override target when the target's **selector** matches the resolved version. The selector therefore names the _unpatched_ range (`'axios@<=0.31.1': 0.32.0`), and the target sits outside it.
- The swapped target is written into `pnpm-lock.yaml` as the importer specifier. `verifyDepsBeforeRun: error` compares that string against the manifest, so a manifest that keeps a range for an overridden package fails the deep check in the Docker builders and the dev launcher.
- `minimumReleaseAge: 20160` (14 days, strict) hides younger releases. A fix inside the window is reachable only through an explicit override, so one lift can be load-bearing today and a no-op once the release ages in.

Image-scan policy, receipts, and the scanned images: [docs/ci-and-deployment.md](../../../docs/ci-and-deployment.md).

## Verdicts

| Verdict        | Meaning                                                                            | Action                                                  |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `load-bearing` | An edge resolves below the target without the entry                                | keep                                                    |
| `line-pin`     | The target sits inside its own selector: one line pinned so importers share a copy | keep                                                    |
| `exact-pin`    | No selector at all (by-name lockstep pin)                                          | keep                                                    |
| `no-op`        | No edge's natural resolution lands in the selector                                 | drop (step 2)                                           |
| `absent`       | The package is not in the locked graph                                             | drop                                                    |
| `downgrade`    | An edge resolves above the target                                                  | loosen, drop, or record why the older release is wanted |

## Step 1 — Audit the entries

```bash
node .agents/skills/klicker-dependency-overrides/scripts/audit-overrides.mjs \
  --root . --modules <installed checkout> --manifests <installed checkout> \
  --json /tmp/override-audit.json
```

Both flags name one checkout of this repository with a `node_modules` tree, usually the primary checkout: `--modules` resolves the script's own `yaml` and `semver` imports, `--manifests` reads the locked manifests that carry each dependent's declared range. Inside an installed checkout both are optional. Registry metadata is cached per package under `$TMPDIR/klicker-override-audit` after the first run.

Each `LIFT` row is the entry's justification: the dependent, the field, the declared range, and the version pnpm would resolve today. A `RANGES UNAVAILABLE` row names a dependent whose manifest the run could not read — add its checkout with `--manifests` before trusting an empty result for that entry. An `OPTIONAL PEER` row names a dependent that installed the package only through `peerDependenciesMeta`, so it carries no declared range and neither justifies nor refutes the entry.

**Done when** every entry reads `load-bearing`, `line-pin`, or `exact-pin`; every `no-op` and `absent` entry has been dropped in step 2; and every `downgrade` is either dropped or explained in the PR description.

## Step 2 — Drop a no-op

```bash
git show HEAD:pnpm-workspace.yaml > /tmp/workspace-before.yaml
# remove the entries from pnpm-workspace.yaml and fix up the grouping comments
pnpm install --lockfile-only
node .agents/skills/klicker-dependency-overrides/scripts/verify-dropped.mjs \
  --root . --modules <installed checkout> --before /tmp/workspace-before.yaml
pnpm install --lockfile-only --frozen-lockfile
```

`verify-dropped` diffs the override sets and checks the regenerated lockfile for any version that lands back inside a dropped selector — the one way a dropped entry can be wrong.

**Done when** `verify-dropped` prints `problems=0`, the frozen install exits 0, and the lockfile diff contains only the `overrides` block, restored peer ranges, and the importer specifiers you aligned in step 4.

## Step 3 — Add a lift for an advisory

Write the entry as `'<name>@<selector below the fix>': <fix>`, where `<fix>` is the first release the scanner accepts. Keep the fix's own major line when the advisory has one there; cross the major only when it does not, and check for a dependent upgrade before accepting the cross-major pin:

```bash
npm view <dependent> version dependencies.<name> peerDependencies.<name>
```

When a workspace manifest declares the package directly, the override will rewrite that importer specifier, so pin the manifest to the exact fix and add a `semverGroups` exception in `.syncpackrc.mjs` — the default dev rule demands `~`, which fights the deep check. The `vitest` and `lodash` entries there are the pattern to copy.

**Done when** the audit reads `load-bearing` for the new entry, `pnpm run check:all` passes, the drift scan in step 4 reports zero mismatches, and the Trivy receipt of the affected image no longer carries the advisory (a ready PR run; the scan legs skip draft builds).

## Step 4 — Repair specifier drift

```bash
node .agents/skills/klicker-dependency-overrides/scripts/scan-spec-mismatch.mjs \
  --root . --modules <installed checkout>
```

Each `MISMATCH` names the importer, the dependency, and both specifier strings. Align the manifest to the lockfile specifier (the override target, exact) and add the matching `semverGroups` exception.

**Done when** the scan prints `mismatches=0`, or every remaining mismatch is owned by another open PR; `pnpm run check:all` stays green.

## Pitfalls

- Resolving the whole graph from scratch (`rm pnpm-lock.yaml` before the install) is the heaviest check available and OOMs the Node process on a laptop, especially with a second run in parallel. The audit reconstructs the same answer per edge; reach for a full fresh resolution only when a verdict is disputed.
- Overrides rewrite `peerDependencies` in the lockfile too (`ws: ^8` becomes `ws: 8.21.0`). Restored peer ranges in a drop's diff are the intended result, not drift.
- Regenerate `pnpm-lock.yaml` with the pnpm named in the `packageManager` field, so the diff stays limited to the override change; another global major rewrites unrelated entries.
- A lift whose fix is inside the 14-day window keeps working, but the audit will read `no-op` for it once the release ages in and the dependent ranges already allow it — that is the intended time for step 2.

Provenance: the 2026-09-19 audit ran these three scripts against `v3-ai` (lockfile `a40d105cfd`), dropped 17 stale image-scan lifts, and left 13 entries that read `load-bearing` (10), `line-pin` (1), and `exact-pin` (2).
