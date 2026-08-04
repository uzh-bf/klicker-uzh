# Chatbot Evaluation Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only CLI that exports one or more chatbots and their nested
conversation histories as pseudonymized, AI-friendly JSON.

**Architecture:** Extend `@klicker-uzh/export` with a separate chatbot CLI, a
pure deterministic transformation layer, and a read-only Prisma query/file
writer. Keep the existing course exporter unchanged and expose one nested JSON
artifact per run.

**Tech Stack:** TypeScript 6, Node.js 24, Prisma 7, Vitest 3, Rollup 4, pnpm 11

## Global Constraints

- Accept one or more repeated `--chatbotId` values; no other input is required.
- Produce nested JSON for AI evaluation, not a database-import format.
- Include `Chatbot`, `ChatThread`, `ChatMessage`, and `ChatAttachment` metadata.
- Omit attachment base64 payloads, secrets, infrastructure URLs, owner/course
  relations, participant records, credit balances, disclaimers, and MCP data.
- Remap privacy-relevant identifiers deterministically to five-digit,
  type-prefixed values starting at one.
- Preserve semantic model identifiers and arbitrary free text.
- Label the artifact pseudonymized, not anonymized.
- Use the existing compile-time/runtime read-only Prisma guard.
- Write directories as `0700` and files as `0600` under the gitignored output
  directory.
- Add no dependencies and make no Prisma schema changes.
- Preserve the existing course-export CLI and output behavior.

---

## Planned file structure

- `packages/export/src/chatbotCli.ts` owns chatbot-only CLI usage and parsing.
- `packages/export/src/chatbotTransform.ts` owns raw/output types, canonical
  ordering, identifier maps, content rewriting, and the pure nested transform.
- `packages/export/src/chatbotExport.ts` owns the read-only Prisma select,
  missing-row validation, JSON serialization, permissions, and export result.
- `packages/export/src/scripts/export-chatbots.ts` is the thin executable.
- `packages/export/test/chatbotExport.test.ts` contains focused unit and
  service-level tests with a fake read-only client.
- Existing package config, exports, README, and wiki files receive only wiring
  and documentation edits.

### Task 1: Add the chatbot CLI parser

**Files:**

- Create: `packages/export/src/chatbotCli.ts`
- Create: `packages/export/test/chatbotExport.test.ts`

**Interfaces:**

- Produces: `CHATBOT_EXPORT_USAGE: string`
- Produces:
  `parseExportChatbotArgs(args: string[]): { chatbotIds: string[]; outputDir: string }`
- Consumes: existing `CliUsageError` from `packages/export/src/cli.ts`

- [ ] **Step 1: Write failing parser tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  CHATBOT_EXPORT_USAGE,
  parseExportChatbotArgs,
} from '../src/chatbotCli.js'
import { CliUsageError } from '../src/cli.js'

describe('chatbot export CLI', () => {
  it('parses, de-duplicates, and sorts repeated chatbot ids', () => {
    expect(
      parseExportChatbotArgs([
        '--',
        '--chatbotId',
        'chatbot-b',
        '--chatbotId',
        'chatbot-a',
        '--chatbotId',
        'chatbot-b',
        '--outputDir',
        '/tmp/export',
      ])
    ).toEqual({
      chatbotIds: ['chatbot-a', 'chatbot-b'],
      outputDir: '/tmp/export',
    })
  })

  it('uses the safe default output directory', () => {
    expect(parseExportChatbotArgs(['--chatbotId', 'chatbot-a'])).toEqual({
      chatbotIds: ['chatbot-a'],
      outputDir: './export-output',
    })
  })

  it.each([
    [],
    ['--chatbotId'],
    ['--chatbotId', '--outputDir'],
    ['--unknown'],
    ['--chatbotId', 'chatbot-a', '--outputDir', 'a', '--outputDir', 'b'],
  ])('rejects malformed arguments: %j', (args) => {
    expect(() => parseExportChatbotArgs(args)).toThrow(CliUsageError)
  })

  it('uses the chatbot usage text for help', () => {
    expect(() => parseExportChatbotArgs(['--help'])).toThrow(
      CHATBOT_EXPORT_USAGE
    )
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```bash
pnpm --filter @klicker-uzh/export test -- chatbotExport.test.ts
```

Expected: FAIL because `../src/chatbotCli.js` does not exist.

- [ ] **Step 3: Implement the parser**

```ts
import { CliUsageError } from './cli.js'

export const CHATBOT_EXPORT_USAGE =
  'Usage: pnpm --filter @klicker-uzh/export export:chatbots -- --chatbotId <id> [--chatbotId <id2> ...] [--outputDir <path>]\n' +
  'Writes one nested, pseudonymized JSON file for AI evaluation. Message text and attachment descriptions remain unchanged.'

function readOptionValue(args: string[], index: number, option: string) {
  const value = args[index + 1]
  if (value == null || value.startsWith('--') || value.trim() === '') {
    throw new CliUsageError(`Missing value for ${option}`)
  }
  return value
}

export function parseExportChatbotArgs(args: string[]): {
  chatbotIds: string[]
  outputDir: string
} {
  const chatbotIds = new Set<string>()
  let outputDir = './export-output'
  let outputDirSet = false

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '--') continue
    if (arg === '--chatbotId') {
      chatbotIds.add(readOptionValue(args, index, arg))
      index++
      continue
    }
    if (arg === '--outputDir') {
      if (outputDirSet) throw new CliUsageError('Duplicate --outputDir')
      outputDir = readOptionValue(args, index, arg)
      outputDirSet = true
      index++
      continue
    }
    if (arg === '--help' || arg === '-h') {
      throw new CliUsageError(CHATBOT_EXPORT_USAGE)
    }
    throw new CliUsageError(`Unknown argument: ${arg}`)
  }

  if (chatbotIds.size === 0) {
    throw new CliUsageError('At least one --chatbotId is required')
  }

  return { chatbotIds: [...chatbotIds].sort(), outputDir }
}
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
pnpm --filter @klicker-uzh/export test -- chatbotExport.test.ts
```

Expected: PASS for all `chatbot export CLI` cases.

- [ ] **Step 5: Commit the CLI slice**

```bash
git add packages/export/src/chatbotCli.ts packages/export/test/chatbotExport.test.ts
git commit -m "feat(export): add chatbot export CLI parser"
```

### Task 2: Build deterministic pseudonymization and nesting

**Files:**

- Create: `packages/export/src/chatbotTransform.ts`
- Modify: `packages/export/test/chatbotExport.test.ts`

**Interfaces:**

- Produces: `RawChatbotExportRow` and nested output interfaces
- Produces:
  `buildChatbotExportDocument(rows: RawChatbotExportRow[], exportedAt: string): ChatbotExportDocument`
- Produces:
  `createKeyMap(values: string[], prefix: string): Map<string, string>`
- Consumes: Prisma-compatible JSON values and Decimal-like values exposing
  `toString()`

- [ ] **Step 1: Add failing transformation tests**

Add a `describe('chatbot export transformation', ...)` block that constructs
two deliberately out-of-order chatbots with shared participants, parent-linked
messages, a repeated `toolCallId`, a known source UUID inside structured
content, a Decimal-like `creditsUsed`, and attachment image fields. Assert the
following exact contract:

```ts
const document = buildChatbotExportDocument(
  [rawChatbotB, rawChatbotA],
  '2026-08-04T12:00:00.000Z'
)

expect(document.chatbots.map((chatbot) => chatbot.id)).toEqual([
  'chatbot_00001',
  'chatbot_00002',
])
expect(document.chatbots[0]!.threads[0]!.participantId).toBe(
  'participant_00001'
)
expect(document.chatbots[0]!.threads[0]!.messages[1]!.parentId).toBe(
  'message_00001'
)
expect(document.chatbots[0]!.threads[0]!.messages[0]!.content).toMatchObject([
  { toolCallId: 'tool_call_00001' },
])
expect(document.chatbots[0]!.threads[0]!.messages[0]!.creditsUsed).toBe(
  '1.250000'
)
expect(
  document.chatbots[0]!.threads[0]!.messages[0]!.attachments[0]
).not.toHaveProperty('imageBase64')
expect(JSON.stringify(document)).not.toContain('source-chatbot-a')
expect(document.counts).toEqual({
  chatbots: 2,
  participants: 1,
  threads: 2,
  messages: 3,
  attachments: 1,
})
```

Add separate tests that assert:

```ts
expect(() => buildChatbotExportDocument([orphanParentRow], exportedAt)).toThrow(
  'Unresolved parent message id'
)
expect(
  buildChatbotExportDocument([emptyChatbot], exportedAt).chatbots[0]!.threads
).toEqual([])
```

- [ ] **Step 2: Run the focused test and verify the missing-function failure**

Run:

```bash
pnpm --filter @klicker-uzh/export test -- chatbotExport.test.ts
```

Expected: FAIL because `chatbotTransform.ts` does not exist.

- [ ] **Step 3: Implement the raw and output contracts**

Create explicit raw row interfaces for only the selected Prisma fields:

```ts
import type { Prisma } from '@klicker-uzh/prisma/client'

interface DecimalLike {
  toString(): string
}

export interface RawChatbotExportRow {
  id: string
  name: string
  description: string | null
  systemPrompts: Prisma.JsonValue | null
  creditInitialCredits: number
  creditResetPeriod: string
  creditResetAmount: number
  creditMaxCredits: number
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
  threads: Array<{
    id: string
    title: string | null
    participantId: string
    createdAt: Date
    updatedAt: Date
    messages: Array<{
      id: string
      parentId: string | null
      role: string
      content: Prisma.JsonValue
      chatMode: string | null
      modelId: string | null
      reasoningEffort: string | null
      reasoningContent: string | null
      creditsUsed: DecimalLike | null
      createdAt: Date
      updatedAt: Date
      attachments: Array<{
        id: string
        type: string
        position: number
        imageDescription: string | null
        createdAt: Date
        updatedAt: Date
      }>
    }>
  }>
}
```

Define output interfaces whose fields exactly match the design spec:

```ts
export interface ChatbotExportAttachment {
  id: string
  type: string
  position: number
  imageDescription: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatbotExportMessage {
  id: string
  parentId: string | null
  role: string
  content: Prisma.JsonValue
  chatMode: string | null
  modelId: string | null
  reasoningEffort: string | null
  reasoningContent: string | null
  creditsUsed: string | null
  createdAt: string
  updatedAt: string
  attachments: ChatbotExportAttachment[]
}

export interface ChatbotExportThread {
  id: string
  participantId: string
  title: string | null
  createdAt: string
  updatedAt: string
  messages: ChatbotExportMessage[]
}

export interface ChatbotExportChatbot {
  id: string
  name: string
  description: string | null
  systemPrompts: Prisma.JsonValue | null
  creditInitialCredits: number
  creditResetPeriod: string
  creditResetAmount: number
  creditMaxCredits: number
  modelSelection: boolean
  allowedModelIds: string[]
  allowedReasoningEffortsByModel: Prisma.JsonValue | null
  createdAt: string
  updatedAt: string
  threads: ChatbotExportThread[]
}

export interface ChatbotExportDocument {
  schemaVersion: 1
  exportedAt: string
  privacy: { mode: 'pseudonymized'; warning: string }
  scope: {
    includedModels: readonly string[]
    excludedModels: readonly string[]
    attachmentImagesIncluded: false
  }
  counts: {
    chatbots: number
    participants: number
    threads: number
    messages: number
    attachments: number
  }
  chatbots: ChatbotExportChatbot[]
}
```

- [ ] **Step 4: Implement canonical maps and structured-content rewriting**

```ts
export function createKeyMap(values: string[], prefix: string) {
  const unique = [...new Set(values)].sort()
  return new Map(
    unique.map((value, index) => [
      value,
      `${prefix}_${String(index + 1).padStart(5, '0')}`,
    ])
  )
}

function collectToolCallIds(value: Prisma.JsonValue, ids: Set<string>) {
  if (Array.isArray(value)) {
    for (const entry of value) collectToolCallIds(entry, ids)
    return
  }
  if (value == null || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'toolCallId' && typeof entry === 'string') ids.add(entry)
    collectToolCallIds(entry, ids)
  }
}

function rewriteContent(
  value: Prisma.JsonValue,
  knownIds: Map<string, string>,
  toolCallIds: Map<string, string>,
  key?: string
): Prisma.JsonValue {
  if (typeof value === 'string') {
    if (key === 'toolCallId') return toolCallIds.get(value) ?? value
    return knownIds.get(value) ?? value
  }
  if (Array.isArray(value)) {
    return value.map((entry) => rewriteContent(entry, knownIds, toolCallIds))
  }
  if (value == null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      rewriteContent(entryValue, knownIds, toolCallIds, entryKey),
    ])
  )
}
```

Merge each type-specific source map into `knownIds`. Throw an explicit
`Ambiguous source identifier` error if the same source string would map to two
different export keys.

- [ ] **Step 5: Implement the pure nested transform**

Add deterministic ordering and required-map helpers:

```ts
function compareDateThenId(
  left: { id: string; createdAt: Date },
  right: { id: string; createdAt: Date }
) {
  return (
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  )
}

function requiredKey(
  map: Map<string, string>,
  sourceId: string,
  label: string
) {
  const value = map.get(sourceId)
  if (value == null) throw new Error(`Unresolved ${label}: ${sourceId}`)
  return value
}

function mergeKnownIds(...maps: Array<Map<string, string>>) {
  const merged = new Map<string, string>()
  for (const map of maps) {
    for (const [sourceId, exportId] of map) {
      const existing = merged.get(sourceId)
      if (existing != null && existing !== exportId) {
        throw new Error(`Ambiguous source identifier: ${sourceId}`)
      }
      merged.set(sourceId, exportId)
    }
  }
  return merged
}
```

Build the transform with all maps established before output objects are
constructed, so forward parent references and repeated tool-call references
resolve:

```ts
const scope = {
  includedModels: ['Chatbot', 'ChatThread', 'ChatMessage', 'ChatAttachment'],
  excludedModels: [
    'ChatUsageCredits',
    'ChatbotDisclaimer',
    'ChatbotMCPConfig',
    'ChatbotMCPServer',
    'User',
    'Course',
    'Participant',
  ],
  attachmentImagesIncluded: false,
} as const

export function buildChatbotExportDocument(
  rows: RawChatbotExportRow[],
  exportedAt: string
): ChatbotExportDocument {
  const chatbots = [...rows].sort((left, right) =>
    left.id.localeCompare(right.id)
  )
  const threads = chatbots.flatMap((chatbot) => chatbot.threads)
  const messages = threads.flatMap((thread) => thread.messages)
  const attachments = messages.flatMap((message) => message.attachments)

  const chatbotIds = createKeyMap(
    chatbots.map((chatbot) => chatbot.id),
    'chatbot'
  )
  const participantIds = createKeyMap(
    threads.map((thread) => thread.participantId),
    'participant'
  )
  const threadIds = createKeyMap(
    threads.map((thread) => thread.id),
    'thread'
  )
  const messageIds = createKeyMap(
    messages.map((message) => message.id),
    'message'
  )
  const attachmentIds = createKeyMap(
    attachments.map((attachment) => attachment.id),
    'attachment'
  )
  const toolCallSourceIds = new Set<string>()
  for (const message of messages) {
    collectToolCallIds(message.content, toolCallSourceIds)
  }
  const toolCallIds = createKeyMap([...toolCallSourceIds], 'tool_call')
  const knownIds = mergeKnownIds(
    chatbotIds,
    participantIds,
    threadIds,
    messageIds,
    attachmentIds
  )

  for (const message of messages) {
    if (message.parentId != null && !messageIds.has(message.parentId)) {
      throw new Error(`Unresolved parent message id: ${message.parentId}`)
    }
  }

  return {
    schemaVersion: 1,
    exportedAt,
    privacy: {
      mode: 'pseudonymized',
      warning:
        'Conversation text and attachment descriptions are unchanged; this export is not anonymized.',
    },
    scope,
    counts: {
      chatbots: chatbots.length,
      participants: participantIds.size,
      threads: threads.length,
      messages: messages.length,
      attachments: attachments.length,
    },
    chatbots: chatbots.map((chatbot) => ({
      id: requiredKey(chatbotIds, chatbot.id, 'chatbot id'),
      name: chatbot.name,
      description: chatbot.description,
      systemPrompts: chatbot.systemPrompts,
      creditInitialCredits: chatbot.creditInitialCredits,
      creditResetPeriod: chatbot.creditResetPeriod,
      creditResetAmount: chatbot.creditResetAmount,
      creditMaxCredits: chatbot.creditMaxCredits,
      modelSelection: chatbot.modelSelection,
      allowedModelIds: chatbot.allowedModelIds,
      allowedReasoningEffortsByModel: chatbot.allowedReasoningEffortsByModel,
      createdAt: chatbot.createdAt.toISOString(),
      updatedAt: chatbot.updatedAt.toISOString(),
      threads: [...chatbot.threads].sort(compareDateThenId).map((thread) => ({
        id: requiredKey(threadIds, thread.id, 'thread id'),
        participantId: requiredKey(
          participantIds,
          thread.participantId,
          'participant id'
        ),
        title: thread.title,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        messages: [...thread.messages]
          .sort(compareDateThenId)
          .map((message) => ({
            id: requiredKey(messageIds, message.id, 'message id'),
            parentId:
              message.parentId == null
                ? null
                : requiredKey(messageIds, message.parentId, 'parent id'),
            role: message.role,
            content: rewriteContent(message.content, knownIds, toolCallIds),
            chatMode: message.chatMode,
            modelId: message.modelId,
            reasoningEffort: message.reasoningEffort,
            reasoningContent: message.reasoningContent,
            creditsUsed: message.creditsUsed?.toString() ?? null,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt.toISOString(),
            attachments: [...message.attachments]
              .sort(
                (left, right) =>
                  left.position - right.position ||
                  left.id.localeCompare(right.id)
              )
              .map((attachment) => ({
                id: requiredKey(attachmentIds, attachment.id, 'attachment id'),
                type: attachment.type,
                position: attachment.position,
                imageDescription: attachment.imageDescription,
                createdAt: attachment.createdAt.toISOString(),
                updatedAt: attachment.updatedAt.toISOString(),
              })),
          })),
      })),
    })),
  }
}
```

Do not spread raw rows; the explicit object construction prevents newly added
database fields from leaking into future exports.

- [ ] **Step 6: Run focused tests and type checking**

Run:

```bash
pnpm --filter @klicker-uzh/export test -- chatbotExport.test.ts
pnpm --filter @klicker-uzh/export check
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 7: Commit the transformation slice**

```bash
git add packages/export/src/chatbotTransform.ts packages/export/test/chatbotExport.test.ts
git commit -m "feat(export): pseudonymize chatbot conversations"
```

### Task 3: Query and write the read-only export

**Files:**

- Create: `packages/export/src/chatbotExport.ts`
- Modify: `packages/export/test/chatbotExport.test.ts`

**Interfaces:**

- Produces:
  `exportChatbotData(prisma: ReadonlyPrismaClient, chatbotIds: string[], outputDir: string, options?: { exportedAt?: string }): Promise<ChatbotExportResult>`
- Produces: `ChatbotExportResult` with `outputPath`, `counts`, and `document`
- Consumes: `buildChatbotExportDocument`

- [ ] **Step 1: Add failing service tests with a fake read-only client**

Add tests that use a fake `chatbot.findMany` delegate and a temporary directory:

```ts
const result = await exportChatbotData(
  fakeReadonlyPrisma([rawChatbotA]),
  ['source-chatbot-a'],
  outputDir,
  { exportedAt: '2026-08-04T12:00:00.000Z' }
)

expect(result.outputPath).toBe(
  join(outputDir, 'chatbot-export-2026-08-04T12-00-00-000Z.json')
)
expect(statSync(outputDir).mode & 0o777).toBe(0o700)
expect(statSync(result.outputPath).mode & 0o777).toBe(0o600)
expect(await readFile(result.outputPath, 'utf8')).toBe(
  `${JSON.stringify(result.document, null, 2)}\n`
)
```

Add a missing-row test using requested IDs `['source-chatbot-a',
'source-chatbot-b']` while the fake returns only A. Assert the rejection names
`source-chatbot-b` and `readdir(outputDir)` remains empty.

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```bash
pnpm --filter @klicker-uzh/export test -- chatbotExport.test.ts
```

Expected: FAIL because `chatbotExport.ts` does not exist.

- [ ] **Step 3: Implement the explicit Prisma select**

```ts
import type { Prisma } from '@klicker-uzh/prisma/client'

const CHATBOT_EXPORT_SELECT = {
  id: true,
  name: true,
  description: true,
  systemPrompts: true,
  creditInitialCredits: true,
  creditResetPeriod: true,
  creditResetAmount: true,
  creditMaxCredits: true,
  modelSelection: true,
  allowedModelIds: true,
  allowedReasoningEffortsByModel: true,
  createdAt: true,
  updatedAt: true,
  threads: {
    select: {
      id: true,
      title: true,
      participantId: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        select: {
          id: true,
          parentId: true,
          role: true,
          content: true,
          chatMode: true,
          modelId: true,
          reasoningEffort: true,
          reasoningContent: true,
          creditsUsed: true,
          createdAt: true,
          updatedAt: true,
          attachments: {
            select: {
              id: true,
              type: true,
              position: true,
              imageDescription: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.ChatbotSelect
```

This allowlist must not select `openaiApiKey`, `openaiBaseUrl`, `ownerId`,
`courseId`, `disclaimerId`, `avatar`, participant records, or attachment image
fields.

- [ ] **Step 4: Implement validation and safe JSON writing**

Query with `findMany({ where: { id: { in: uniqueIds } }, select:
CHATBOT_EXPORT_SELECT })`. Compare the requested ID set with returned rows and
throw `Chatbots not found: <sorted list>` before creating the output directory.
Build the document before file-system writes so transform failures also leave
no artifact.

```ts
const exportedAt = options.exportedAt ?? new Date().toISOString()
const document = buildChatbotExportDocument(rows, exportedAt)
const filename = `chatbot-export-${exportedAt.replace(/[:.]/g, '-')}.json`
mkdirSync(outputDir, { recursive: true, mode: 0o700 })
chmodSync(outputDir, 0o700)
const outputPath = join(outputDir, filename)
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o600,
})
chmodSync(outputPath, 0o600)
return { outputPath, counts: document.counts, document }
```

- [ ] **Step 5: Run focused tests, check, and build**

Run:

```bash
pnpm --filter @klicker-uzh/export test -- chatbotExport.test.ts
pnpm --filter @klicker-uzh/export check
pnpm --filter @klicker-uzh/export build
```

Expected: all commands PASS.

- [ ] **Step 6: Commit the export service**

```bash
git add packages/export/src/chatbotExport.ts packages/export/test/chatbotExport.test.ts
git commit -m "feat(export): write chatbot evaluation JSON"
```

### Task 4: Wire the executable and document operator usage

**Files:**

- Create: `packages/export/src/scripts/export-chatbots.ts`
- Modify: `packages/export/src/index.ts`
- Modify: `packages/export/rollup.config.js`
- Modify: `packages/export/package.json`
- Modify: `packages/export/README.md`
- Modify: `docs/data-and-migrations.md`
- Modify: `docs/chat-platform.md`

**Interfaces:**

- Produces package commands `export:chatbots` and `export:chatbots:dev`
- Produces compiled executable `dist/scripts/export-chatbots.js`
- Preserves existing commands `export` and `export:dev`

- [ ] **Step 1: Create the executable wrapper**

```ts
import { prisma } from '@klicker-uzh/prisma'

import { CHATBOT_EXPORT_USAGE, parseExportChatbotArgs } from '../chatbotCli.js'
import { exportChatbotData } from '../chatbotExport.js'
import { CliUsageError } from '../cli.js'
import '../prismaTypes.js'
import { createReadonlyClient } from '../readonlyPrisma.js'

const readonlyPrisma = createReadonlyClient(prisma)

try {
  const { chatbotIds, outputDir } = parseExportChatbotArgs(
    process.argv.slice(2)
  )
  const result = await exportChatbotData(readonlyPrisma, chatbotIds, outputDir)
  console.log(`Export complete: ${result.outputPath}`)
  console.log(
    `Exported ${result.counts.chatbots} chatbot(s), ${result.counts.threads} thread(s), ${result.counts.messages} message(s), and ${result.counts.attachments} attachment description(s).`
  )
} catch (error) {
  if (error instanceof CliUsageError) {
    console.error(error.message)
    if (error.message !== CHATBOT_EXPORT_USAGE) {
      console.error(CHATBOT_EXPORT_USAGE)
    }
    process.exitCode = 1
  } else {
    throw error
  }
} finally {
  await prisma.$disconnect()
}
```

- [ ] **Step 2: Wire library and Rollup entries**

Append to `src/index.ts`:

```ts
export { exportChatbotData } from './chatbotExport.js'
```

Change the Rollup CLI input to include both executables:

```js
input: [
  'src/scripts/export-course.ts',
  'src/scripts/export-chatbots.ts',
],
```

- [ ] **Step 3: Add package commands without changing dependencies**

Set these exact script/bin entries in `packages/export/package.json`:

```json
{
  "scripts": {
    "build:ts": "cross-env NODE_ENV=production rollup -c && chmod +x dist/scripts/export-course.js dist/scripts/export-chatbots.js",
    "export:chatbots": "node dist/scripts/export-chatbots.js",
    "export:chatbots:dev": "tsx src/scripts/export-chatbots.ts"
  },
  "bin": {
    "klicker-export": "dist/scripts/export-course.js",
    "klicker-export-chatbots": "dist/scripts/export-chatbots.js"
  }
}
```

Retain every existing script and package field not shown above.

- [ ] **Step 4: Update operator and engineering documentation**

Add a `Chatbot evaluation export` section to `packages/export/README.md` with:

```bash
pnpm --filter @klicker-uzh/export build
pnpm --filter @klicker-uzh/export export:chatbots -- \
  --chatbotId 8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f
```

Document the repeated ID, optional output directory, nested file shape,
included/excluded models, exact pseudonymization policy, omitted attachment
images, restricted permissions, and the warning that unchanged message content
can contain personal data.

Update `docs/data-and-migrations.md` under the adjacent export section to
distinguish course analysis exports from chatbot evaluation exports. Update
`docs/chat-platform.md` with a short operator-export paragraph that points to
the package README and states that the exporter reads Prisma models rather than
the in-flight route-handler architecture.

- [ ] **Step 5: Run package verification**

Run:

```bash
pnpm --filter @klicker-uzh/export test
pnpm --filter @klicker-uzh/export check
pnpm --filter @klicker-uzh/export build
pnpm exec prettier --check packages/export/README.md docs/data-and-migrations.md docs/chat-platform.md
```

Expected: all commands PASS and both compiled scripts exist under
`packages/export/dist/scripts/`.

- [ ] **Step 6: Commit executable and documentation wiring**

```bash
git add packages/export/src/scripts/export-chatbots.ts packages/export/src/index.ts packages/export/rollup.config.js packages/export/package.json packages/export/README.md docs/data-and-migrations.md docs/chat-platform.md
git commit -m "docs(export): document chatbot evaluation exports"
```

### Task 5: Run end-to-end verification and privacy inspection

**Files:**

- Verify only; modify implementation/tests/docs only when a check exposes a
  defect

**Interfaces:**

- Consumes compiled and development chatbot CLIs
- Produces verification evidence for the draft pull request

- [ ] **Step 1: Run targeted mechanical checks**

```bash
pnpm --filter @klicker-uzh/export test
pnpm --filter @klicker-uzh/export check
pnpm --filter @klicker-uzh/export build
pnpm run format:check
opengrep scan --config auto packages/export
```

Expected: PASS with zero findings attributable to this branch.

- [ ] **Step 2: Smoke-test the seeded chatbot through devrouter**

```bash
devrouter ensure .
devrouter exec . -- pnpm --filter @klicker-uzh/export export:chatbots:dev -- --chatbotId 8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f --outputDir /tmp/chatbot-export-smoke
devrouter exec . -- find /tmp/chatbot-export-smoke -maxdepth 1 -name 'chatbot-export-*.json' -type f
```

Expected: one JSON path and a successful summary. If the existing devcontainer
is unavailable, record the environment blocker; do not reset or reseed a
database for this smoke test.

- [ ] **Step 3: Inspect the smoke artifact without exposing its content**

Run a structural assertion inside the devcontainer that prints only the schema
version and aggregate counts:

```bash
devrouter exec . -- find /tmp/chatbot-export-smoke -maxdepth 1 -name 'chatbot-export-*.json' -type f -exec node --input-type=module -e "import { readFileSync, statSync } from 'node:fs'; const path = process.argv[1]; const text = readFileSync(path, 'utf8'); const document = JSON.parse(text); const sourceId = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'; if (document.schemaVersion !== 1) throw new Error('Unexpected schema version'); if (text.includes(sourceId)) throw new Error('Source chatbot ID leaked'); if (text.includes('openaiApiKey') || text.includes('imageBase64')) throw new Error('Excluded field leaked'); if ((statSync(path).mode & 0o777) !== 0o600) throw new Error('Unsafe file mode'); if (!document.chatbots.every((chatbot) => /^chatbot_[0-9]{5}$/.test(chatbot.id))) throw new Error('Invalid chatbot key'); console.log(JSON.stringify({ schemaVersion: document.schemaVersion, counts: document.counts }));" {} \;
```

Expected: one compact JSON summary. The assertion verifies schema version `1`,
export-local chatbot key format, absence of the selected source chatbot UUID,
absence of `openaiApiKey`/`imageBase64`, and file mode `0600`.

- [ ] **Step 4: Run repository checks through the normal commit hook**

Stage only implementation-scope files, inspect all staged content for secrets
and personal data, then create the final implementation commit if verification
required follow-up edits:

```bash
git diff --check
git status --short
git diff --cached
git commit -m "test(export): verify chatbot evaluation export"
```

Expected: the hook completes `check:all` successfully. Skip this extra commit
when no follow-up files changed.

### Task 6: Review, push, and open the draft pull request

**Files:**

- Review the complete branch diff against `v3`
- Create a temporary PR body outside the repository when CLI fallback is needed

**Interfaces:**

- Produces a pushed `feat/export-chatbot-evaluation-data` branch
- Produces one draft GitHub pull request targeting `v3`

- [ ] **Step 1: Run an independent final branch review**

Give a fresh review agent this bounded request: inspect
`git diff v3...HEAD` for correctness, privacy leakage, deterministic ID mapping,
read-only guarantees, file permissions, test gaps, documentation consistency,
and maintainability. Require file/line evidence and prohibit edits.

Resolve accepted findings one at a time, rerunning the focused test after each.
Explicitly record deferred findings and rationale.

- [ ] **Step 2: Run the strict maintainability review**

Invoke `$thermo-nuclear-code-quality-review` against the final branch diff.
Resolve findings or record a concrete deferral rationale before publication.

- [ ] **Step 3: Recheck the full branch scope**

```bash
git status -sb
git log --oneline v3..HEAD
git diff --stat v3...HEAD
git diff --check v3...HEAD
```

Expected: clean worktree, only approved export/docs changes, and no diff errors.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feat/export-chatbot-evaluation-data
```

Expected: upstream tracking is configured successfully.

- [ ] **Step 5: Open the draft pull request against `v3`**

Create the PR through the GitHub connector when available, with conventional
title:

```text
feat(export): add pseudonymized chatbot evaluation export
```

The body must summarize the full branch, included/excluded tables, identifier
policy, pseudonymized-not-anonymized warning, attachment decision, exact CLI
usage, verification results, smoke-test status, and review findings. Fall back
to:

```bash
gh pr create --draft --base v3 --head feat/export-chatbot-evaluation-data --title "feat(export): add pseudonymized chatbot evaluation export" --body-file /tmp/chatbot-export-pr.md
```

Expected: one draft PR URL targeting `v3`; do not merge or mark ready.
