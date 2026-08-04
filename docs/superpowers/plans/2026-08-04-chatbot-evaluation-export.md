# Chatbot Evaluation Export Implementation Record

**Goal:** Add a read-only CLI that exports one or more chatbots and their nested
conversation histories as pseudonymized, AI-friendly JSON.

**Branch:** `feat/export-chatbot-evaluation-data`, targeting `v3` as one
ordinary draft pull request.

## Delivered structure

- `chatbotCli.ts` parses repeated `--chatbotId` values and the optional output
  directory.
- `chatbotTransform.ts` provides the pure, deterministic nested transform,
  export types, identifier maps, and relationship validation.
- `chatbotExport.ts` owns the explicit read-only Prisma projection, missing-row
  checks, serialization, and safe artifact writing.
- `scripts/export-chatbots.ts` is the thin executable.
- Separate CLI, transform, and service test files cover each boundary.

## Completed work

- [x] Accept one or more repeated `--chatbotId` values and de-duplicate them.
- [x] Produce one nested JSON document organized as chatbots, threads,
      messages, and attachment metadata.
- [x] Include `ChatAttachment` descriptions and metadata while omitting base64
      image payloads.
- [x] Exclude secrets, infrastructure configuration, owner/course relations,
      participant records, disclaimer/MCP data, and credit balances.
- [x] Replace privacy-relevant record and relationship IDs with deterministic,
      type-prefixed values starting at one.
- [x] Keep semantic model IDs and all message/reasoning text unchanged.
- [x] Scope tool-call identifiers by thread so unrelated provider IDs cannot be
      linked accidentally.
- [x] Reject missing, cross-thread, self-referencing, and cyclic parent-message
      relationships before touching the filesystem.
- [x] Use the existing compile-time and runtime read-only Prisma guard.
- [x] Create new output directories owner-only, require existing directories to
      already be owner-only, and write files with `0600` permissions.
- [x] Publish artifacts through an exclusive temporary file and atomic
      no-clobber link so existing files and symlinks are never followed or
      overwritten.
- [x] Keep the existing course exporter unchanged and add no dependencies or
      schema changes.
- [x] Update package documentation and the engineering wiki.

## Verification evidence

- `pnpm --filter @klicker-uzh/export test` — 46 tests passed after final review
  fixes.
- `pnpm --filter @klicker-uzh/export check` — passed.
- `pnpm --filter @klicker-uzh/export build` — passed.
- compiled `export:chatbots -- --help` — passed with exit code zero.
- `pnpm run check:all` — passed.
- `pnpm run build` — passed before final review; the push hook reruns it.
- `opengrep scan --config auto packages/export` — zero findings.

The isolated devrouter smoke command reached Prisma, but the fresh worktree
database did not contain the `Chatbot` table (`P2021`). It produced no export
artifact. A destructive reset/reseed was intentionally not performed; the
automated service test exercises the same query, transformation, and file
boundary with a read-only fake client.

## Durable contract

The behavior and privacy contract live in:

- `docs/superpowers/specs/2026-08-04-chatbot-evaluation-export-design.md`
- `packages/export/README.md`
- `docs/chat-platform.md`
- `docs/data-and-migrations.md`
