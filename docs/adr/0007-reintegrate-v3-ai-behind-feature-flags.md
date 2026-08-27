# 7. Reintegrate `v3-ai` into `v3` behind feature flags, after VK2

- **Status:** Accepted — 2026-08-16

## Context

`v3-ai` is not a stale branch. Verified against the repository on 2026-08-16, it
holds an entire merged-but-unreleased product capability that does not exist on
`v3` at all:

| Source   | What                                                            |
| -------- | --------------------------------------------------------------- |
| PR #5080 | Planning record for the Klicker MCP server and chat integration |
| PR #5090 | `apps/mcp-student` — the student practice MCP server            |
| PR #5083 | LTI semi-anonymous guest access for `apps/chat`                 |
| PR #5109 | `apps/mcp-lecturer` and the embedded lecturer assistant         |
| PR #5295 | AI assistant surface documentation and wiki alignment           |

A tree comparison confirms that `apps/mcp-lecturer` and `apps/mcp-student` exist
only on `v3-ai`. Meanwhile `v3` has moved 67 commits ahead of it (as of
2026-08-16, and growing), absorbing the entire student chat delivery through an
unrelated series and taking Next.js 16, React 19, and the removal of Cypress with
it.

Two forces are in tension. The capability is finished enough to be worth shipping
and stale enough that every additional week of divergence makes the merge harder.
But the merge would land lecturer-facing and student-facing AI surfaces into `v3`
roughly two weeks before VK2 (31.08.–04.09.2026), which is already the first
full-stack run of the new infrastructure, UI, and tutoring.

Shipping it dark is only possible if a feature-flag mechanism exists. At the time
of this decision it does not: PR #5322 (shared GrowthBook foundation) and PR #5323
(manage-side gating) are both open drafts.

## Decision

`v3-ai` is reintegrated into `v3` behind GrowthBook flags, **after VK2**, in this
order:

1. Land #5322 and #5323 on `v3` first. They gate three independent rollouts — the
   lecturer assistant, the MCP servers, and learning analytics — which makes them
   shared infrastructure rather than a feature of any one of them.
2. Merge `v3` into `v3-ai` and stabilise there, absorbing Next.js 16, React 19, and
   the Cypress removal away from the release branch.
3. Test the assistant and both MCP servers thoroughly on the reintegrated branch.
4. Merge `v3-ai` into `v3` with every new surface flagged **default-off**.
5. Retire `v3-ai` once nothing targets it, retargeting PR #5174 (production-ready
   knowledge base management) at whichever repository owns KB lifecycle under
   ADR 0006.

GrowthBook is consequently a hard-locked v3.5 dependency. It is not an isolated
feature-flag convenience; three separate releases block on it.

## Considered options

**Merge before VK2.** Rejected. VK2 is already the first live exercise of
everything else that changed since VK1, which validated only the new ingestion
pipeline and the auto router on the old infrastructure. Adding a branch this far
behind to that window multiplies the number of untested interactions at exactly
the moment the system is under real student load.

**Abandon `v3-ai` and rebuild on `v3`.** Rejected. The capability is complete and
was reviewed when it merged; discarding it to re-derive the same result is waste.

**Keep `v3-ai` as a permanent second integration line.** Rejected. It has no owner,
no release process, and no CI parity with `v3`, and the divergence is already large
enough to be the main obstacle to shipping.

## Consequences

- The lecturer assistant and MCP servers do not appear in VK2. VK2 tests the student
  chat path only.
- Anything on `v3-ai` that has to be demonstrated before reintegration needs its own
  deployable environment, which does not exist today.
- The GrowthBook stack becomes critical path. If #5322 and #5323 slip, three
  rollouts slip with them.
- Step 2 concentrates the merge pain on `v3-ai`, where a broken build blocks nobody
  else. `v3` stays releasable throughout.
- Flags shipped default-off mean the code is in production untested by real use.
  Enabling each surface is a separate decision with its own verification, not a
  consequence of the merge.
