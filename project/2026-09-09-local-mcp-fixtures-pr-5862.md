# Scoped local retrieval fixtures

[Draft PR #5862 — scoped local retrieval fixtures](https://github.com/uzh-bf/klicker-uzh/pull/5862)
adds an optional document corpus and one explicit additional local draft identity.
The public package contains reusable development infrastructure and synthetic
test-owned data. Application-specific teaching material belongs outside this
repository and is not part of the current PR diff.

## Contract

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
