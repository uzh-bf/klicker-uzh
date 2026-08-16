# 6. What public KlickerUZH keeps when Catalyst is absent

- **Status:** Accepted — 2026-08-16

> **Name collision.** "Catalyst" in this record always means the private
> `uzh-bf/klicker-uzh-catalyst` repository. It is unrelated to the pre-existing
> auth concept of the same name — the `asUserWithCatalyst` scope and
> `reduceCatalyst` in `packages/util/src/auth.ts`, which flags a user by Edu-ID
> affiliation. The two never refer to each other.

## Context

The AI-native components of KlickerUZH are moving into the private
`uzh-bf/klicker-uzh-catalyst` repository: the Mastra tutoring engine, learning
analytics, content generation, the knowledge graph, and formative feedback and
grading. The rule agreed for the split is that only adapters and basic versions
land in public v3, while the real implementations live in Catalyst.

That rule is not self-applying. Every future PR can argue about what counts as an
adapter, and the argument has real stakes in both directions: too thin a public
floor and KlickerUZH stops being a credible open-source product that another
institution can self-host; too thick a floor and the proprietary layer has no
substance left to protect.

The question this ADR settles is deliberately narrow and testable: **an
institution that runs public KlickerUZH alone, with no Catalyst services
deployed, gets what — per capability?**

Three possible floors exist:

- **Stub** — contract plus a no-op. The capability is simply absent without Catalyst.
- **Degraded default** — contract plus a deterministic fallback that is honest about
  being less capable.
- **Working simple version** — contract plus a genuinely useful implementation, with
  Catalyst as a quality upgrade rather than the only way to have the feature.

## Decision

The floor is set per capability, not globally.

| Capability                   | Public floor                                 | What a Catalyst-less deployment gets                                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tutoring / student chat      | **Working simple version**                   | The current production approach stays public: retrieval-augmented chat built on the AI SDK with a system prompt and MCP tools. This is a real tutoring experience, not a placeholder. The Mastra engine is the Catalyst upgrade |
| Knowledge graph              | **Working control plane, stub construction** | Public owns the lecturer workspace, the build request, and the terminal build status. Graph construction itself is Catalyst-only, so builds do not complete without it                                                          |
| Learning analytics           | **Stub**                                     | Nothing. A degraded psychometric engine produces numbers that look authoritative and are not, and wrong learning analytics are worse than absent ones                                                                           |
| Content generation           | **Stub**                                     | Nothing. There is no meaningful degraded mode for generating questions from course material                                                                                                                                     |
| Formative feedback / grading | **Degraded default**                         | Deterministic rubric scoring without the AI layer. Genuinely useful on its own, and honest about what it does not do                                                                                                            |

`chat-api` and `chat-engine` are the public platform boundary and build around
_both_ engine implementations — the public AI SDK engine and the Catalyst Mastra
engine — rather than around either one specifically. This is the mechanism that
makes the tutoring row above possible without forking the surface.

A capability whose public floor is **Stub** must still ship its contract, its
authorization, and its product state in public. Only the computation is private.
Public KlickerUZH owns product state, authorization, UI, and canonical contracts;
Catalyst services implement the private computation behind those contracts.

### The shape of a private engine

Moving a capability to Catalyst is a redesign, not a file move. Public and private
halves are separated by a public API, and the private half is constrained:

- **A private engine performs no database-level work.** It does not read or write
  KlickerUZH tables, own migrations, or hold product state. It receives what it needs
  through the contract and returns a terminal result.
- **A private engine knows nothing about the UI.** No copy, no locale, no rendering
  concerns, no assumptions about which screen invoked it.
- **The public API is the whole of the coupling.** Anything a private engine needs from
  product state travels through it explicitly.

Existing implementations were written without this separation, so most transfers
require restructuring rather than relocation. Git history is carried across where it
survives the restructuring; where it does not, the public API contract — not the
commit trail — is the artifact that must be right.

## Consequences

- Self-hosting KlickerUZH remains worthwhile: a working chatbot, a working editor
  and quiz platform, and deterministic rubric grading all function alone.
- Learning analytics and content generation become visibly Catalyst-gated features.
  The UI must say so rather than failing silently, which is new work in public.
- Open PRs that currently build private-side implementations in the public repo have
  to be reclassified against this table. The knowledge-graph stack splits along the
  orchestration boundary rather than moving wholesale.
- A future capability inherits no default. Adding one means adding a row here.
