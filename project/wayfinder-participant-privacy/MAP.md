# Map: Participant Privacy & Auth — Readiness

Labels: `wayfinder:map`
Governs: [PR #5128 participant privacy/auth plan](../2026-06-16-pr5128-participant-privacy-auth-plan.md)
Charted: 2026-07-31

## Destination

The PR #5128 plan is **decision- and implementation-ready**: its claims about the
codebase re-verified with evidence against current `v3`, its target design confirmed
viable on the current stack, every open decision equipped with the input it needs and a
written recommendation, and the surfaces that need a prototype before committing
identified as such.

Reached when no ticket remains and someone can pick up Slice 1 without further
investigation.

## Notes

**Domain.** Participant identity, authentication, and personal-data retention in
KlickerUZH. The governing plan is the linked PR #5128 document — the single source of
truth. This map does not restate it; it finds the way to making it actionable.

**Skills every session should consult.** `/grilling` and `/domain-modeling` for the
HITL tickets. `/rs-sliced-development-workflow` owns execution once this map is done.
Security-touching conclusions route through `/security-review` per the repo's review
routing.

**Standing preferences.**

- This repo is **public**. Anything pushed is permanent public history. Severity
  statements about vulnerabilities are fine; mechanism and reproduction detail is not.
  Route those through the internal security channel.
- Login-method questions are answered from **existing data composition first**
  (see [Measure participant login-method composition](tickets/T02-login-method-composition.md)),
  not by shipping telemetry and waiting.
- The 2026-07-06 review verdict stands. Slice sequencing, migration strategy, and the
  Slice 4 encryption approach are **not** re-opened — see Out of scope.

**Tracker conventions.** No issue tracker is wired to this repo for agent use — ClickUp
is the team's source of truth but its MCP server is unauthenticated, and GitHub Issues
are not actively used here. This map therefore uses the local-markdown tracker: the map
is this file, tickets are files under `tickets/`. A ticket is **claimed** by filling its
`Assignee:` field before any work. A ticket is **closed** by setting `Status: closed`,
appending a `## Resolution` section, and adding its one-line gist to Decisions so far
below. `Blocked by:` lists ticket ids; a ticket is takeable when all of them are closed.

## Frontier

Open, unblocked, unclaimed — takeable right now:

- [Re-verify the plan's 13 codebase claims against current v3](tickets/T01-reverify-codebase-claims.md) — research, AFK
- [Measure participant login-method composition](tickets/T02-login-method-composition.md) — task
- [Assess passkey viability and pin SimpleWebAuthn](tickets/T04-passkey-viability.md) — research, AFK
- [Identify which surfaces need a prototype](tickets/T09-prototype-surfaces.md) — grilling, HITL

Blocked: [Confirm the target data model holds under Prisma 7](tickets/T03-target-model-prisma7.md),
[Decide the ParticipantAccount migration shape](tickets/T05-participantaccount-shape.md),
[Decide recovery setup timing](tickets/T06-recovery-setup-timing.md),
[Decide cutover date and grace windows](tickets/T07-cutover-windows.md),
[Assemble the DPO decision package](tickets/T08-dpo-package.md).

## Decisions so far

<!-- one line per closed ticket: enough to judge relevance, then open the link for detail -->

_None yet — map just charted._

## Not yet specified

<!-- in-scope fog: real, but not sharp enough to ticket -->

- **The prototypes themselves.** Once [Identify which surfaces need a prototype](tickets/T09-prototype-surfaces.md)
  names them, each becomes its own prototype ticket. Likely candidates from the plan's
  review notes: recovery setup during a running live quiz, the shared-device passkey
  warning, and the create-account flow once random username prefill is gone.
- **Whether Slice 0 telemetry is still needed at all.** Composition data may answer the
  three dependent decisions outright. If it does not, a scoped telemetry ticket
  graduates from here with a much narrower question than "four weeks of everything".
- **Student communication plan specifics.** The plan has a section for it, but its
  content depends on the cutover shape, which is not decided yet.
- **Slice 3 rework beyond the LTI 1.1 note.** The email-fallback link branch still needs
  migration handling for participants who link by email today; how much is unclear until
  the target model is confirmed.
- **Knock-on sequencing changes.** If the target model or passkey approach needs
  revision, some slices may reorder. Cannot be specified before those tickets land.

## Out of scope

<!-- past the destination; closed, never graduates -->

- **The DPO's and Product's actual rulings.** This map produces the package they rule
  on, not the ruling. Their calendars are outside it.
- **Slices 1–7 implementation.** The destination is readiness to implement, not the
  implementation. Hands off to `/rs-sliced-development-workflow`.
- **Re-opening migration sequencing, slice order, and the Slice 4 encryption approach.**
  Settled by the 2026-07-06 review; re-litigating them was explicitly declined when this
  map was chartered.
- **LTI 1.1 retirement.** Already shipped in PR #5260, merged to `v3` as `7812fa71ce`.
