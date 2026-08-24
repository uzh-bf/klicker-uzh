# Demo participant seeding

## Goal

Provide one dedicated production participant account for each of the three
demo courses owned by `klick`, with credentials generated and retained only in
the approved Infisical profile.

## Non-goals

- Do not change chatbot configuration, course ownership, publication, or
  provider state.
- Do not alter or delete the existing shared `teststudent` account.
- Do not rename or delete existing participant accounts or participation rows.
- Do not print, commit, or send passwords, hashes, email addresses, raw IDs, or
  database connection details.
- Do not seed STG, send lecturer messages, or run model/provider calls.

## Target map

| Label | Course name | Required chatbot | Username | Password secret |
| --- | --- | --- | --- | --- |
| IuW | `testkurs IuW` | `Informatik und Wirtschaft` | `teststudent-iuw` | `KLICKER_DEMO_IUW_PARTICIPANT_PASSWORD` |
| RadioSurfVet | `testkurs RadioSurfVet` | `RadioSurfVet` | `teststudent-rsv` | `KLICKER_DEMO_RADIOSURFVET_PARTICIPANT_PASSWORD` |
| Culture | `Demo Course Copy` | `Culture Scenario Lab` | `teststudent-culture` | `KLICKER_DEMO_CULTURE_PARTICIPANT_PASSWORD` |

The script resolves the owner by shortname `klick` and requires exactly one
unarchived course and one same-owner chatbot for every row. The Culture
username is new; the IuW and RadioSurfVet usernames are existing dedicated
accounts with one inactive matching participation each. The shared
`teststudent` account is an explicit denylist entry.

## Execution contract

- `Authority`: the user requested these three participant accounts and a
  reusable seed path. Local repository edits, local checks, and the values-free
  production dry-run are in scope. Production account writes and Infisical
  allowlist or secret writes remain separate named gates.
- `Boundary owner`: `self` through local verification; production secret and
  database mutations stop at their explicit gates.
- `Terminal`: locally committed and reviewed script/documentation, followed by
  values-free PRD dry-run and, after the remaining approvals, one atomic apply
  with independent readback. No publication or provider call.
- `Pause`: stop on missing/ambiguous/archived targets, SSO-backed dedicated
  accounts, active off-target participation that cannot be safely reconciled,
  missing password mappings, operator permission gaps, test skips, or any
  unexpected production drift.

## Design

- Default CLI mode is read-only dry-run; `--readback` is read-only and does not
  require password variables; `--apply` is explicit and requires all three
  operator-injected password variables.
- Apply uses one serializable Prisma transaction and re-resolves all owner,
  course, chatbot, account, and participation guards inside the transaction.
- Missing participants are manual, active, non-public accounts without an
  email. Existing dedicated participants retain identifying fields and receive
  the injected password, active account state, private profile state, and a
  matching leaderboard participation. Active off-target leaderboard
  participations are deactivated, never deleted. `Participation.isActive` is
  not an enrollment, course-access, or chatbot-security flag; these updates do
  not grant or revoke access.
- Replays preserve the stored bcrypt hash when the injected password already
  matches and skip already-satisfied updates, so a stable rerun is a database
  no-op.
- Output is limited to fixed labels, action names, and booleans. Prisma errors
  are reduced to stable failure categories at the CLI boundary.

## Infisical contract

Profile: `klicker-prd`, mapped to `klicker-uzh-dev/prd`.

The operator must have both read and write access for exactly these three
password names. Read access injects values into the child script; write access
is needed only for the explicit initial `set-random --bytes 32` operations.
No wildcard, prefix, raw Infisical CLI, `.env`, or repository fallback is
allowed. Password values are never read back, printed, hashed outside the
application password check, or persisted anywhere else.

## Slices and checks

1. **Plan and branch** — fresh `v3` task worktree; commit this plan first.
2. **Participant reconciler** — add the Prisma script, focused tests, and the
   package entry point. Run `pnpm --filter @klicker-uzh/prisma-data
   test:demo-participants` against an isolated disposable database; the command
   fails closed when its marker or local-host guard is absent. Never use the
   normal development or PRD database.
3. **Operator documentation** — document dry-run/apply/readback, target map,
   secret names, and values-free output in `docs/data-and-migrations.md`.
4. **PRD operation** — verify operator status and permissions, request exact
   allowlist approval, generate missing password secrets, run the production
   dry-run, then apply once and read back account/participation invariants.

The password variables are intentionally not added to `turbo.json` global
environment inputs. That would propagate credential values to every Turbo
task; the documented direct operator child keeps them scoped to this script.

Test obligations cover exact target resolution, no-write dry-run/readback,
atomic rollback, account creation and reconciliation, shared-account
protection, replay no-op behavior, and missing-password/SSO/flag/target
fail-closed paths.

## Progress

- Plan reviewed by the configured planner with the concerns above incorporated.
- The task branch was rebased onto the freshly fetched `origin/v3` head
  `e906f9b3da150c39cc6c3d9f650a19fb74fc190f` before the final review.
- The reconciler, package command, focused tests, operator documentation, and
  this plan are committed locally. The disposable task runtime suite passes 9
  tests, including readback failure, archived-target refusal, conflicting-mode
  refusal, shared-account preservation, atomic rollback, and replay no-op.
- The focused suite is fail-closed unless `TEST_DATABASE_DISPOSABLE=1` is set
  and the test URL points to a local/DevPod PostgreSQL host. Its dedicated
  package command additionally requires that guard and exits non-zero when it
  is missing. The fixture refuses pre-existing owner or participant rows and
  cleans only participant IDs created by the current run. The suite covers
  committed repair of existing manual targets as well as replay no-op behavior.
- PRD target rows and existing account shape were inspected read-only. The
  values-free PRD dry-run now resolves all three targets and reports the two
  existing dedicated accounts plus the missing Culture account without writes.
  No PRD database, Infisical, provider, lecturer, deployment, or cluster write
  has occurred.
