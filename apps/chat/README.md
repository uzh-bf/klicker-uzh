# For experimenting with MCP tools:

## Context7

clone the [Context7 repo](https://github.com/upstash/context7.git)

```bash
git clone https://github.com/upstash/context7.git
cd context7
pnpm install
```

start the MCP server

```bash
pnpm run build
node dist/index.js --transport http --port $PORT
```

## Direct-Chat canary

The behavior-based canary executable is
scripts/prd-direct-chat-canary.ts. Its name and receipt workflow identify the
PRD direct-Chat canary behavior, not a roadmap work item or task package.

It is an operator-only, one-shot transaction. With the reviewed environment
and explicit data-change authorization, it creates a run-scoped synthetic
fixture, performs one no-model direct retrieval and auth/isolation checks, then
restores and deletes the synthetic state. The receipt stores only allowlisted
status, identity, provenance, and postcondition fields.

Run its focused tests from apps/chat with:

```bash
pnpm vitest run test/prd-direct-chat-canary.test.ts
```

Do not run the executable against a live environment without the corresponding
reviewed canary authorization. It is not a general-purpose migration or
cleanup script.
