# Chatbot Evaluation Export Design

## Goal

Add a read-only command-line exporter that accepts one or more `Chatbot.id`
values and writes one AI-friendly JSON file containing the selected chatbot
configurations and their conversation histories. Privacy-relevant identifiers
are replaced with deterministic, export-local identifiers starting at one.

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

The output directory is created with mode `0700` and the file with mode `0600`,
following the existing export package. The directory remains gitignored.

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
  "chatbots": [
    {
      "id": "chatbot_00001",
      "name": "Example",
      "threads": [
        {
          "id": "thread_00001",
          "participantId": "participant_00001",
          "messages": [
            {
              "id": "message_00001",
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

- export-local `id`
- `name`, `description`, and `systemPrompts`
- credit configuration fields
- `modelSelection`, `allowedModelIds`, and
  `allowedReasoningEffortsByModel`
- `createdAt` and `updatedAt`
- nested threads

The exported `ChatThread` data contains:

- export-local `id` and `participantId`
- `title`, `createdAt`, and `updatedAt`
- nested messages

The exported `ChatMessage` data contains:

- export-local `id` and nullable remapped `parentId`
- `role`, `content`, `chatMode`, `modelId`, and `reasoningEffort`
- `reasoningContent` and `creditsUsed`
- `createdAt` and `updatedAt`
- nested attachments

The exported `ChatAttachment` data contains:

- export-local `id`
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
only by export-local identifiers on threads.

## Identifier policy

Privacy-relevant record and relationship identifiers are replaced consistently
within one export:

| Source identifier          | Export value         |
| -------------------------- | -------------------- |
| `Chatbot.id`               | `chatbot_00001`      |
| `ChatThread.participantId` | `participant_00001`  |
| `ChatThread.id`            | `thread_00001`       |
| `ChatMessage.id`           | `message_00001`      |
| `ChatMessage.parentId`     | matching message key |
| `ChatAttachment.id`        | `attachment_00001`   |
| JSON property `toolCallId` | `tool_call_00001`    |

Mappings are type-specific, start at one, and use five-digit zero padding.
They are deterministic for the same selected database state and independent of
the order of CLI inputs or Prisma query results. Participant mappings are
shared across all selected chatbots in the same file.

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
4. Establish canonical ordering and build the export-local identifier maps.
5. Validate that every non-null message `parentId` resolves to an exported
   message. Abort on an unresolved relationship.
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

## Components

The implementation extends `packages/export` with focused units:

- chatbot CLI parsing and usage text
- Prisma query and raw row types
- deterministic identifier mapping and nested transformation
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
- an unresolved parent-message relationship
- query, transformation, serialization, or file-system failure

A chatbot with no threads, a thread with no messages, and a message with no
attachments are valid results rather than errors.

## Verification

Automated tests cover:

- repeated chatbot IDs, de-duplication, optional output directory, and CLI
  failures
- deterministic one-based mappings independent of input/query order
- correct nesting and consistent participant, parent-message, and tool-call
  references
- replacement of known source IDs inside structured content
- absence of original structural UUIDs and excluded secret/configuration fields
- omission of attachment image payloads while retaining descriptions
- date and decimal serialization
- missing-chatbot and unresolved-parent failures without output
- empty chatbot/thread handling
- owner-only file and directory permissions

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
