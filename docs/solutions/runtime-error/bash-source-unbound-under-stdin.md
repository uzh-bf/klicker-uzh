---
module: ci
date: 2026-08-29
problem_type: runtime_error
severity: low
symptoms:
  - 'bash: line 427: BASH_SOURCE[0]: unbound variable'
  - 'A script that works via direct invocation fails when streamed over SSH with bash -s'
root_cause: 'With set -u, ${BASH_SOURCE[0]} is unset when Bash reads the script from stdin, so the standard main-entrypoint guard crashes instead of comparing against $0.'
tags:
  - bash
  - set-u
  - stdin
  - github-actions-runners
---

# ${BASH_SOURCE[0]} Is Unset Under `set -u` When a Script Is Streamed via stdin

## Problem

The two-host runner controller streams `reconcile-hetzner-arm64-runner-host.sh`
to VMs with `ssh ... 'bash -s -- --check' < payload`. The same script that ran
correctly as a file aborted on every host before reaching validation. Blast
radius: all checksum-pinned streamed administration commands were blocked; no
remote state changed because the crash occurred at parse/entrypoint time.

## Symptoms

- `bash: line 427: BASH_SOURCE[0]: unbound variable` immediately after the
  controller printed `Checking <host>`.
- Direct file execution (`bash script.sh --help`) printed usage normally.

## What Didn't Work

- Suspecting the VMs: both hosts were innocent; the payload had already passed
  its pinned SHA-256 check before streaming.
- Suspecting damaged transfer: the controller verifies the checksum twice
  (download and after upload), so corruption was already excluded.
- Testing only via `bash script.sh`: the direct-invocation path always sets
  `BASH_SOURCE[0]`, so the bug cannot reproduce there.

## Solution

Default the array element in the entrypoint guard:
`[[ "${BASH_SOURCE[0]:-$0}" == "$0" ]]`
([util/reconcile-hetzner-arm64-runner-host.sh:427](../../../util/reconcile-hetzner-arm64-runner-host.sh)).
Fixed in PR
[#5655](https://github.com/uzh-bf/klicker-uzh/pull/5655), commit `dd5c766c5`.

## Why This Works

When Bash reads a program from stdin, no source file exists, so
`BASH_SOURCE[0]` is unset; under `set -u`, referencing it is a fatal error.
Substituting `$0` (here, `bash`'s stdin placeholder) keeps the guard
meaningful and lets the entrypoint comparison evaluate safely.

## Prevention

`util/reconcile-hetzner-arm64-runner-host.test.sh` now executes the script via
the exact streamed path, `bash -s -- --help < script`, and asserts the usage
text, so any future `set -u` incompatibility with stdin execution fails in
seconds locally before reaching a host.
