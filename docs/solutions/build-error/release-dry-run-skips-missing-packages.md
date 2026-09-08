---
module: release
date: 2026-09-07
problem_type: build_error
severity: medium
symptoms:
  - Release dry-run exits successfully without processing all intended packages
root_cause: standard-version 9.5.0 ignores missing bump targets while configured directory strings contain missing separators and moved paths
tags: [release, standard-version, monorepo]
---

# A successful release dry-run can skip packages

## Problem

The release configuration concatenates directory strings with `package.json`.
Missing trailing separators and paths left behind by package moves yielded
nonexistent targets. Installed standard-version 9.5.0 silently ignores those
missing files during its bump lifecycle, so exit code zero did not establish
that the intended package versions would change together.

## Symptoms

The dry-run completed, but its output omitted configured package targets.
Seven directory strings lacked separators; LTI and Hatchet referenced their
former locations.

## What did not work

Checking only the exit code, root version and changelog missed partial target
coverage. The first host run used Node 22 and was excluded from qualification;
repeating with pinned Node 24 reproduced the same omission.

## Solution

Correct the existing paths in [the release configuration](../../../.versionrc.js).
Preserve the intended package set instead of adding every workspace package.
The qualification dry-run processed all 21 configured targets after correction.

## Why this works

Every configured target now resolves to an existing package manifest. Explicit
coverage assertions detect missing targets even when the release tool exits
successfully.

## Prevention

Before publication, require every configured bump target to exist and parse as
the intended package. Run the repository's dry-run with the pinned toolchain,
check that output processes every target, and compare all target checksums,
changelog, HEAD, tags and Git status before and after. A dry-run must change none
of them. Keep release execution and publication separately authorized.
