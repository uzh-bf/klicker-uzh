# 6. What public KlickerUZH keeps when Catalyst is absent

- **Status:** Accepted — 2026-08-16

> **One name, two layers.** Catalyst is the paid tier, and the repository is named
> after it. The entitlement half already exists in public: `catalystInstitutional`
> and `catalystIndividual` on `User` (migration `20230826093751_catalyst`), derived
> from Edu-ID affiliation by `reduceCatalyst` in `packages/util/src/auth.ts`,
> surfaced as the `catalyst` auth scope in `packages/graphql/src/builder.ts`, and
> spent through `asUserWithCatalyst` on 23 mutations in
> `packages/graphql/src/schema/mutation.ts` — practice quizzes, microlearnings, and
> group activities. This record is about the other half: where the _implementation_
> of a paid capability lives. Read a bare "Catalyst" below as the private
> `uzh-bf/klicker-uzh-catalyst` services.

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

| Capability                            | Public floor                                 | What a Catalyst-less deployment gets                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tutoring / student chat               | **Working simple version**                   | The chat surface, the AI SDK loop, the system prompt, and the MCP client. A working chatbot, ungrounded — it answers from the model's own knowledge. Retrieval is not public: `doc_query` is a tool name public chat namespaces and cites, never one it implements, and the corpus behind it is Catalyst. The Mastra engine is the further upgrade                                      |
| Knowledge graph                       | **Working control plane, stub construction** | Public owns the lecturer workspace, the build request, and the terminal build status. Graph construction itself is Catalyst-only, so builds do not complete without it                                                                                                                                                                                                                  |
| Learning analytics                    | **Stub**                                     | Nothing. A degraded psychometric engine produces numbers that look authoritative and are not, and wrong learning analytics are worse than absent ones                                                                                                                                                                                                                                   |
| Content generation                    | **Stub**                                     | Nothing. There is no meaningful degraded mode for generating questions from course material                                                                                                                                                                                                                                                                                             |
| Student-initiated practice candidates | **Working simple version**                   | Inside a configured course-chatbot mode, the chat route drafts flashcards (later questions) as candidate elements, each source-linked to metadata from its own retrieval call and saved only by the student into their personal elements (ADR 0027). Needs a retrieval server; without one the feature is absent. KG-backed generation is the Catalyst upgrade behind the same contract |
| Formative feedback / grading          | **Degraded default**                         | Deterministic rubric scoring without the AI layer. Genuinely useful on its own, and honest about what it does not do                                                                                                                                                                                                                                                                    |

`chat-api` and `chat-engine` are the public platform boundary and build around
_both_ engine implementations — the public AI SDK engine and the Catalyst Mastra
engine — rather than around either one specifically. This is the mechanism that
makes the tutoring row above possible without forking the surface.

**For tutoring, MCP is that public API.** Public chat is an MCP client: it connects
to servers by URL (`apps/chat/src/services/mcpClients.ts`), namespaces their tools,
and renders their output as sources and citations. It does not know what a tool does
on the other side. Retrieval therefore needs no special case — a Catalyst deployment
registers a `doc_query` server and the same public surface becomes grounded, while a
deployment without one keeps working ungrounded. Adding retrieval to public would
mean adding a corpus, embeddings, and a vector store to this repository, which is
what the floor rules out.

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

- Self-hosting KlickerUZH remains worthwhile: a working editor and quiz platform,
  deterministic rubric grading, and a working chatbot all function alone — the
  chatbot ungrounded, and able to be grounded by any MCP server the operator runs,
  Catalyst's or their own.
- Learning analytics and content generation become visibly Catalyst-gated features.
  The UI must say so rather than failing silently, which is new work in public.
- Entitlement and availability are two different gates, and both apply. The existing
  `catalyst` scope answers "is this user on the paid tier"; this ADR's floor answers
  "are the private services deployed at all". A self-hosting institution can have
  entitled users and no Catalyst deployment, so a stub capability cannot infer
  availability from `asUserWithCatalyst` alone.
- Open PRs that currently build private-side implementations in the public repo have
  to be reclassified against this table. The knowledge-graph stack splits along the
  orchestration boundary rather than moving wholesale.
- A future capability inherits no default. Adding one means adding a row here.
- Amended 2026-08-21: the student-initiated practice candidates row was added
  when that capability was designed (ADR 0026, ADR 0027). It is the one place
  where drafting questions from course material is public, because the draft
  is grounded per card by the retrieval tool the deployment already has and is
  never lecturer content.
