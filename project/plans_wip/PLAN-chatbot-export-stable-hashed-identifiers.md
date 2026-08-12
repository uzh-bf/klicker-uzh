# Chatbot export: stable hashed identifiers

## Goal

Replace every sequential export-local identifier in the chatbot evaluation
JSON with a deterministic, one-way SHA-256 pseudonym. The same source ID must
produce the same exported ID across independent export runs so participants and
other exported records can be linked across separately exported chatbots.

## Non-goals

- Do not modify database data or the Prisma schema.
- Do not add a salt, secret, or CLI option.
- Do not hash semantic model identifiers such as `modelId` or
  `allowedModelIds`.
- Do not scan or rewrite arbitrary free text.
- Do not change the included/excluded model allowlist or attachment policy.

## Identifier contract

Every currently pseudonymized structural identifier uses this format:

```text
<type>_<64 lowercase hexadecimal SHA-256 characters>
```

The digest input is the exact source identifier. Examples include
`participant_<digest>`, `message_<digest>`, and `attachment_<digest>`. Type
prefixes remain so an evaluator can distinguish identifier kinds.

The contract applies to:

- `Chatbot.id`
- `ChatThread.id` and `ChatThread.participantId`
- `ChatMessage.id` and valid `ChatMessage.parentId` references
- `ChatAttachment.id`
- warning `threadId` and `messageId` values
- exact known structural IDs inside structured message content
- `toolCallId` values

Tool-call provider IDs remain scoped by thread. Their digest input is the
existing unambiguous combination of source thread ID, a null-byte separator,
and source tool-call ID. Therefore, the same provider tool-call ID in two
threads produces two different exported IDs, while repeated occurrences in one
thread remain consistent.

Missing or cross-thread parent references continue to become `null` only in the
generated JSON. Their warning contains the stable hashed thread and message IDs
but never the unresolved source parent ID. Self-references and cycles remain
hard failures.

## Privacy trade-off

Unsalted SHA-256 is intentionally stable and linkable across exports. It is
appropriate here because the structural identifiers are high-entropy database
or provider IDs and the use case requires cross-export correlation. It is not
anonymization: anyone who already knows a source ID can calculate its exported
pseudonym. The export keeps its existing pseudonymized-not-anonymized warning.

The complete 256-bit digest is retained rather than truncated, avoiding an
unnecessary collision risk. No additional secret or configuration is required,
so `Chatbot.id` remains the only required operator input.

## Layer footprint

- `packages/export`: identifier transformation and unit tests
- `packages/export/README.md`: operator-facing identifier and privacy contract
- `docs/chat-platform.md` and `docs/data-and-migrations.md`: engineering facts
- `docs/log.md`: documentation change record
- existing chatbot-export design and implementation records: align the branch
  documentation with the final behavior

There is no Prisma, GraphQL, frontend, i18n, auth, gamification, Hatchet,
seed, or fixture impact.

## Verification

Tests must prove:

- all structural identifier types use their prefix plus a 64-character SHA-256
  digest
- the same source ID maps identically across independent exports with different
  selected chatbot sets and source ordering
- valid parent and structured-content references resolve to the same hashed ID
- repeated tool-call IDs are stable within a thread and distinct across threads
- warnings use hashed IDs and never disclose unresolved source IDs
- model IDs and free text remain unchanged
- self-referencing and cyclic parents still fail

Verification commands:

```bash
pnpm --filter @klicker-uzh/export test
pnpm --filter @klicker-uzh/export check
pnpm --filter @klicker-uzh/export build
pnpm run check:all
pnpm run build
opengrep scan --config auto packages/export
```

## Delivery slices

1. Add regression tests for stable SHA-256 identifiers across independent
   exports.
2. Replace sequential key generation with deterministic SHA-256 key generation.
3. Align operator, design, and engineering-wiki documentation.
4. Run package and repository verification.
5. Obtain independent final review, commit, push, and update draft PR #5302.

## Implementation plan

### Task 1: Lock the stable identifier contract in tests

**Files:**

- Modify `packages/export/test/chatbotTransform.test.ts`

**Interface:**

- `createHashedKeyMap(values: string[], prefix: string): Map<string, string>`
- `buildChatbotExportDocument(rows, exportedAt): ChatbotExportDocument`

Steps:

1. Replace the sequential-key unit test with a known SHA-256 vector. Assert
   that `source-a` becomes
   `message_0f9f5ce47831e099e77e295ed8bb627f089efa8672ee6fbdc49eac6f0d7f5275`
   and duplicates collapse to one map entry.
2. Update the nested-export assertions for chatbot, participant, thread,
   message, attachment, parent, structured-content, warning, and tool-call IDs.
3. Add an independent-export regression: build two documents with different
   chatbot selections/orderings but the same source participant ID and assert
   that both contain exactly the same `participant_<digest>` value.
4. Keep the existing assertions that model IDs and free text are unchanged and
   source structural IDs are absent.
5. Run
   `pnpm --filter @klicker-uzh/export exec vitest run test/chatbotTransform.test.ts`.
   The new assertions must fail against the sequential implementation.

### Task 2: Replace sequential keys with SHA-256 keys

**Files:**

- Modify `packages/export/src/chatbotTransform.ts`

**Interface:**

```ts
export function createHashedKeyMap(values: string[], prefix: string) {
  return new Map(
    [...new Set(values)].map((value) => [
      value,
      `${prefix}_${createHash('sha256').update(value).digest('hex')}`,
    ])
  )
}
```

Steps:

1. Import `createHash` from `node:crypto`.
2. Replace `createKeyMap` with `createHashedKeyMap`; retain de-duplication and
   type prefixes, but remove index-based assignment and sorting from mapping.
3. Use the new helper for chatbot, participant, thread, message, attachment,
   and thread-scoped tool-call maps. Leave canonical output ordering unchanged.
4. Run the targeted transform test and the full package test suite. All tests
   must pass, including self-reference/cycle failures and orphan-parent
   warnings.

### Task 3: Align the public and engineering contracts

**Files:**

- Modify `packages/export/README.md`
- Modify `docs/chat-platform.md`
- Modify `docs/data-and-migrations.md`
- Modify `docs/log.md`
- Modify the existing chatbot-export design and implementation records
- Modify this plan's progress checklist

Steps:

1. Replace sequential/one-based wording and examples with full SHA-256
   pseudonyms and explicitly document cross-export linkability.
2. State that unsalted hashing is intentional, is not anonymization, and lets
   anyone with a known source ID reproduce the pseudonym.
3. Retain the unchanged read-only, model-ID, text, attachment, and parent-warning
   contracts.
4. Add a `2026-08-12` wiki log entry and bump meaningful wiki page timestamps.
5. Format changed TypeScript with Biome and Markdown with Prettier.

### Task 4: Verify and publish

Steps:

1. Run the package tests, check, build, compiled CLI help, `pnpm run check:all`,
   `pnpm run build`, `git diff --check`, and
   `opengrep scan --config auto packages/export`.
2. Inspect staged files for secrets or real participant/export data. Never add
   the untracked `export-output/` directory.
3. Commit the implementation as
   `feat(export): use stable hashed identifiers`.
4. Ask an independent reviewer to inspect the committed branch diff for
   correctness, privacy, determinism, and documentation consistency; resolve
   accepted findings before push.
5. Push the branch and update draft PR #5302 so its complete branch summary and
   example JSON use hashed identifiers rather than sequential identifiers.

## Progress

- [x] Scope and privacy trade-off approved.
- [x] Regression tests added.
- [x] Stable hash transformation implemented.
- [x] Documentation aligned.
- [x] Verification complete.
- [x] Independent review and PR update complete.
