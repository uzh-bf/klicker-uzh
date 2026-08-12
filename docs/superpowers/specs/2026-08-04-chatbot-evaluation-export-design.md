# Chatbot Evaluation Export Design

## Goal

Add a read-only command-line exporter that accepts one or more `Chatbot.id`
values and writes one AI-friendly JSON file containing the selected chatbot
configurations and their conversation histories. Privacy-relevant identifiers
are replaced with stable, type-prefixed full SHA-256 pseudonyms.

The output is intended for evaluation with an AI system, not for importing back
into the KlickerUZH database.

## Command and output

The exporter belongs in the existing `@klicker-uzh/export` package and is a
separate entry point from the course exporter:

```bash
pnpm --filter @klicker-uzh/export export:chatbots -- \
  --chatbotId <uuid> \
  --chatbotId <uuid>
```

`--chatbotId` is required and repeatable. Duplicate values are de-duplicated.
`--outputDir` is optional and defaults to `./export-output`. No other input is
required.

Each run creates one timestamped file:

```text
export-output/chatbot-export-YYYY-MM-DDTHH-mm-ss-sssZ.json
```

New output directories are created with mode `0700`; an existing directory must
already be owner-only. Files use mode `0600`, and existing files or symlinks are
never overwritten. The default directory remains gitignored.

## JSON structure

The file is nested for direct use by an AI evaluator:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-08-04T12:00:00.000Z",
  "privacy": {
    "mode": "pseudonymized",
    "warning": "Conversation text and attachment descriptions are unchanged; this export is not anonymized."
  },
  "scope": {
    "includedModels": [
      "Chatbot",
      "ChatThread",
      "ChatMessage",
      "ChatAttachment"
    ],
    "excludedModels": [
      "ChatUsageCredits",
      "ChatbotDisclaimer",
      "ChatbotMCPConfig",
      "ChatbotMCPServer",
      "User",
      "Course",
      "Participant"
    ],
    "attachmentImagesIncluded": false
  },
  "counts": {
    "chatbots": 1,
    "participants": 1,
    "threads": 1,
    "messages": 2,
    "attachments": 0
  },
  "warnings": {
    "invalidParentReferences": []
  },
  "chatbots": [
    {
      "id": "chatbot_8b1af2d86812af60213f5b7092c8ebb07fc7c5e77b5bcca1e4faecdfe8cc7422",
      "name": "Example",
      "threads": [
        {
          "id": "thread_2af2a78c9fae773d421456326461d840adae2b9d79916c2f7b49a61190f6cd8d",
          "participantId": "participant_a0aa14b0a5b8dc7d5edcf53f0e43329b7972cc1974a82d0ee2cb8edefe13a115",
          "messages": [
            {
              "id": "message_ae067212f643e9704d7b5343cee469a763dd9eb141adbafbd1b739c3d02a52db",
              "parentId": null,
              "role": "user",
              "content": [{ "type": "text", "text": "Hello" }],
              "attachments": []
            }
          ]
        }
      ]
    }
  ]
}
```

Dates are serialized as ISO-8601 strings. Prisma `Decimal` values, including
`creditsUsed`, are serialized as decimal strings so precision is not lost.

### Included fields

The exported `Chatbot` data contains:

- hashed `id`
- `name`, `description`, and `systemPrompts`
- credit configuration fields
- `modelSelection`, `allowedModelIds`, and
  `allowedReasoningEffortsByModel`
- `createdAt` and `updatedAt`
- nested threads

The exported `ChatThread` data contains:

- hashed `id` and `participantId`
- `title`, `createdAt`, and `updatedAt`
- nested messages

The exported `ChatMessage` data contains:

- hashed `id` and nullable remapped `parentId`; a source parent that does
  not resolve inside the same thread is exported as `null`
- `role`, `content`, `chatMode`, `modelId`, and `reasoningEffort`
- `reasoningContent` and `creditsUsed`
- `createdAt` and `updatedAt`
- nested attachments

The exported `ChatAttachment` data contains:

- hashed `id`
- `type`, `position`, and `imageDescription`
- `createdAt` and `updatedAt`

`imageBase64` and `imagePreviewBase64` are deliberately omitted to keep the
file practical for AI evaluation. Their addition later is isolated to the
attachment projection and output type.

### Excluded fields and models

The exporter never emits `Chatbot.openaiApiKey`, `Chatbot.openaiBaseUrl`,
`ownerId`, `courseId`, `disclaimerId`, or `avatar`. These values are secret,
infrastructure-specific, relationally irrelevant, or cosmetic for the stated
evaluation use case.

`ChatUsageCredits` is excluded because per-participant balances, reset history,
and disclaimer acceptance are operational state rather than conversation
evaluation data. Per-message `creditsUsed` remains included.

`ChatbotDisclaimer`, `ChatbotMCPConfig`, and `ChatbotMCPServer` are excluded
because the export is not a portable runtime configuration. This also prevents
MCP URLs and encrypted authentication secrets from entering the artifact.

`User`, `Course`, and `Participant` rows are excluded to avoid pulling personal
data and unrelated relations into the export. Participants are represented
only by hashed identifiers on threads.

## Identifier policy

Privacy-relevant record and relationship identifiers are replaced consistently
with stable pseudonyms:

| Source identifier          | Export value                             |
| -------------------------- | ---------------------------------------- |
| `Chatbot.id`               | `chatbot_<64 lowercase SHA-256 hex>`     |
| `ChatThread.participantId` | `participant_<64 lowercase SHA-256 hex>` |
| `ChatThread.id`            | `thread_<64 lowercase SHA-256 hex>`      |
| `ChatMessage.id`           | `message_<64 lowercase SHA-256 hex>`     |
| `ChatMessage.parentId`     | matching message pseudonym or `null`     |
| `ChatAttachment.id`        | `attachment_<64 lowercase SHA-256 hex>`  |
| JSON property `toolCallId` | `tool_call_<64 lowercase SHA-256 hex>`   |

Mappings are type-specific and computed as the type prefix plus the full
lowercase hexadecimal SHA-256 digest of the source identifier. They are stable
across separate exports and independent of the selected chatbot set, CLI input
order, or Prisma query order. Participant mappings therefore allow the same
participant to be correlated across separately exported chatbots. Tool-call
source identifiers are scoped by thread before hashing, while their export
values remain unique across the whole file.

The hashes are deliberately unsalted to provide cross-export stability. This
is pseudonymization, not anonymization: anyone who knows a source identifier can
compute its exported pseudonym.

Known source record identifiers are also replaced when an exact string value
appears inside structured message `content`. Exact `toolCallId` properties are
mapped consistently across the exported content. Arbitrary strings and free
text are not scanned or rewritten because doing so could corrupt evaluation
content.

Descriptive identifiers such as `modelId` and `allowedModelIds` remain
unchanged: they identify model configurations rather than users or database
records and are material evaluation context.

## Data flow and safety

1. Parse and validate the repeated chatbot IDs.
2. Query all selected chatbots and their threads, messages, and attachment
   metadata through the export package's existing compile-time and runtime
   read-only Prisma client.
3. Abort without writing if any requested chatbot is missing.
4. Establish canonical ordering and build the stable hashed identifier maps.
5. Inspect parent relationships. Replace a parent that does not resolve inside
   the same thread with `null` in the export and record a warning using only the
   hashed thread and message IDs. Abort on a self-reference or cycle.
6. Transform the queried rows into the nested, secret-free output shape.
7. Serialize one pretty-printed JSON file with a trailing newline and restricted
   permissions.
8. Print the output path and aggregate counts.

Chatbots are ordered by source ID. Threads and messages are ordered by creation
time with source ID as a deterministic tie-breaker. Attachments are ordered by
position with source ID as a tie-breaker. Empty chatbots and empty threads are
valid and remain visible in the output.

The output explicitly identifies itself as pseudonymized, not anonymized.
Thread titles, system prompts, message content, reasoning content, and
attachment descriptions are preserved and can contain personal information.
The operator remains responsible for choosing an approved AI evaluation system
and handling the artifact according to applicable data-protection rules.

The warning does not expose the unresolved source parent ID. Its reason is
`not_in_thread`, which deliberately covers both a missing source row and a
parent row belonging to another thread without querying or exporting that row.
This normalization changes only the generated JSON document; the database is
never updated.

## Components

The implementation extends `packages/export` with focused units:

- chatbot CLI parsing and usage text
- Prisma query and raw row types
- stable SHA-256 identifier mapping and nested transformation
- safe JSON file creation
- a thin executable wrapper that connects, exports, reports, and disconnects

The existing course-export behavior and entry point remain unchanged. No schema
migration or dependency addition is required.

## Error handling

The command exits non-zero and writes no partial artifact for:

- no `--chatbotId`
- a missing option value or unknown argument
- duplicate `--outputDir`
- any requested chatbot ID not found
- a self-referencing or cyclic parent-message relationship
- an unsafe output directory or an existing output file/symlink
- query, transformation, serialization, or file-system failure

A chatbot with no threads, a thread with no messages, a message with no
attachments, and an unresolved or cross-thread parent reference are valid
results rather than errors. The latter produces a `null` exported `parentId`
and a pseudonymized `warnings.invalidParentReferences` entry.

## Verification

Automated tests cover:

- repeated chatbot IDs, de-duplication, optional output directory, and CLI
  failures
- stable SHA-256 mappings independent of the selected set and input/query order
- correct nesting and consistent participant, parent-message, and tool-call
  references
- preservation of exact-token free text and thread-scoped tool-call mappings
- replacement of known source IDs inside structured content
- absence of original structural UUIDs and excluded secret/configuration fields
- omission of attachment image payloads while retaining descriptions
- date and decimal serialization
- missing-chatbot failures without output
- unresolved and cross-thread parents normalized to `null` with pseudonymized
  warnings, without emitting the unresolved source ID
- self-referencing and cyclic parent failures without output
- empty chatbot/thread handling
- owner-only file and directory permissions
- no-clobber handling for existing files and symlinks

Verification runs the export package's tests, TypeScript check, production
build, repository formatting checks, and static analysis. When the seeded local
environment is available, a smoke export against a seeded chatbot provides the
final end-to-end check.

## Delivery

This is a small, cohesive change on
`feat/export-chatbot-evaluation-data`, targeting `v3` as one ordinary draft
pull request. The pull-request description covers the full branch diff and
records the verification evidence. The strict maintainability review runs
before the pull request is presented for review.
