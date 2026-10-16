# Scoped local retrieval fixtures

[Draft PR #5862 — scoped local retrieval fixtures](https://github.com/uzh-bf/klicker-uzh/pull/5862)
adds an optional document corpus and one explicit additional local draft identity.
The public package contains reusable development infrastructure and synthetic
test-owned data. Application-specific teaching material belongs outside this
repository and is not part of the current PR diff.

## Contract

Originally delivered on `v3`; the `v3-ai` reconciliation at the end of this
page describes what the current code implements.

Without an optional fixture, the existing finance seed remains unchanged.
`LOCAL_MCP_DOCUMENTS_FILE` overrides the default local document corpus.
An additional identity uses `LOCAL_MCP_FIXTURE_FILE`, or the ignored default
`project/_local/local-mcp-fixture.json`. The file contains `chatbotId`, `ownerId`,
`courseId`, `kbId`, `chatMode`, and `documentsFile`. Document paths resolve from
the runtime working directory and must be available inside that runtime.

Only the exact signed chatbot/knowledge-base pair selects the additional corpus.
Startup validates draft status, owner, course and mode before inserting one
binding. An invalid explicit file, an unexpected consumer, or a changed owner
fails closed. Keep the ignored identity configuration available while its
binding exists. This is a development fixture, not production authorization.

## Verification and delivery

The reusable implementation passed 35 focused tests, repository type/lint and
remaining checks, 93 host tests and the full 23-task build. Host and container
hooks were split to use the correct toolchains. Direct local HTTP checks proved
corpus separation and rejected crossed identities; repeated startup preserved
one binding. No inference calls occurred.

Independent simplification and security review passed on `d2b63506ba`.
Integrated review passed on `07e295a8ef`; the later relocation removes only
application-specific artifacts and changes one incidental test mode label.
The executable contract is unchanged. The runtime is stopped.

Source is delivered as a draft against `v3`. Required CI, senior human review
and explicit merge authority remain separate gates. No deployment or provider
configuration is included. Earlier published commits still retain the removed
artifacts; this ordinary follow-up does not rewrite Git history.

## v3-ai reconciliation

Merging `v3` into `v3-ai` (PR #5999) adopted this fixture on the isolated
runtime instead of a shared development database. The optional identity is now
the *second* identity next to the dedicated `v3-ai` fixture, so the file
carries `chatbotId`, `kbId`, `chatMode`, and `documentsFile`; its owner and
course are the synthetic local ones the seed already creates.

The guarded Prisma seed creates that additional identity — a draft chatbot, its
knowledge base, one knowledge-base binding, and one enabled `doc_query`
configuration — inside the same serializable transaction as the dedicated
domain, and validates the identical shape on every later startup. Its stored
scope uses the multi-knowledge-base `kb_ids` form every other configuration in
this seed uses, instead of the singleton `kb_id` key. A missing additional
identity is completed additively, while a changed identity, an unexpected
consumer, or any other row fails closed before the transport credential rotates.
The dedicated identity, the accepted scope-token pairs, and the
boolean-by-default authenticator result are unchanged.
