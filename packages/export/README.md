# @klicker-uzh/export

Standalone, **read-only** CLIs for course live-quiz analysis exports and pseudonymized chatbot conversation exports.

It is **not** imported by any app and **not** part of any deployment — it is run manually by an operator, on demand. The only production contact is pointing it at a read-only production `DATABASE_URL`.

## Course live-quiz export

### Scope

Exports **live-quiz data only**:

- `LiveQuizResponse` — one row per response
- `Participation` — enrolled participants
- `ParticipantInvitation` — invitations
- `AppliedPointCorrection` — lecturer point corrections (audit)
- plus two dimension sheets: live quizzes and element instances

It does **not** include practice-quiz / microlearning `QuestionResponse`, `QuestionResponseDetail`, or `GroupActivityInstance`. The scope (included/excluded models) is recorded in every export's `manifest.json` so a course with those activity types is not mistaken for "fully exported".

### Usage

```bash
# build the compiled binary (no tsx at runtime)
pnpm --filter @klicker-uzh/export build

# single course
pnpm --filter @klicker-uzh/export export -- --courseId <uuid> [--outputDir <path>] [--pseudonymize]

# multiple courses (also writes a combined workbook)
pnpm --filter @klicker-uzh/export export -- --courseId <uuid1> --courseId <uuid2>

# development (runs via tsx, no build step)
pnpm --filter @klicker-uzh/export export:dev -- --courseId <uuid>

# against production secrets (read-only URL)
infisical run --env prd -- \
  node packages/export/dist/scripts/export-course.js --courseId <uuid> --outputDir <path>
```

Flags:

- `--courseId <uuid>` — required, repeatable for multi-course export
- `--outputDir <path>` — default `./export-output`
- `--pseudonymize` — de-identify direct identifiers (see below)

### Output

```
<outputDir>/
  <courseName>_<courseId>/
    export.xlsx              # 6 sheets, frozen header + per-column filters
    responses.csv
    participants.csv
    invitations.csv
    corrections.csv
    live_quizzes.csv
    element_instances.csv
    manifest.json            # schema version, counts, scope, per-file SHA-256, data dictionary
  combined-export.xlsx       # only when >1 course is exported
```

Files are written `0600`, directories `0700`.

#### Sheets and join keys

| Sheet               | Join key                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `RESPONSES`         | `liveQuizResponseId` (PK); `elementInstanceId` → `ELEMENT_INSTANCES` |
| `PARTICIPANTS`      | `participantId` (PK)                                                 |
| `INVITATIONS`       | `participantId`                                                      |
| `CORRECTIONS`       | `liveQuizResponseId` + `elementBlockExecution` → `RESPONSES`         |
| `LIVE_QUIZZES`      | `liveQuizId` (includes zero-response quizzes)                        |
| `ELEMENT_INSTANCES` | `elementInstanceId` (full untruncated content + point config)        |

`RESPONSES` carries both the raw `response` JSON and flattened `response_choices` / `response_value` / `response_selection` / `response_assessment` columns so analysts can avoid parsing JSON.

### Safety

- **Read-only DB access** — `createReadonlyClient` narrows the Prisma client to read operations at compile time, and a runtime `$allOperations` guard blocks every non-read operation, including raw queries (`$queryRaw` / `$executeRaw` / `…Unsafe`).
- **PII modes** — default `full` writes identifiers verbatim (with a loud stderr warning); `--pseudonymize` hashes email / SSO id+email / matriculation number (per-run HMAC-SHA256 salt, never persisted) and redacts free-text answers and raw response JSON.
- **CSV** — UTF-8 BOM, one physical line per row (embedded newlines normalized), formula-injection escaping (`= + - @`).
- **Integrity** — `manifest.json` records per-file SHA-256, counts, package version, PII mode, scope, and a data dictionary for the cryptic + flattened columns.

Output directories contain PII and are gitignored.

## Chatbot evaluation export

The chatbot exporter writes one nested JSON file intended for direct evaluation by an AI system. Supply one or more database chatbot IDs; the exporter includes each chatbot's threads, messages, and attachment descriptions.

```bash
# build the compiled binaries
pnpm --filter @klicker-uzh/export build

# one chatbot
pnpm --filter @klicker-uzh/export export:chatbots -- \
  --chatbotId 8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f

# multiple chatbots and a custom output directory
pnpm --filter @klicker-uzh/export export:chatbots -- \
  --chatbotId <uuid1> \
  --chatbotId <uuid2> \
  --outputDir <path>

# development (runs via tsx, no build step)
pnpm --filter @klicker-uzh/export export:chatbots:dev -- \
  --chatbotId <uuid>
```

Flags:

- `--chatbotId <uuid>` — required and repeatable; duplicates are ignored
- `--outputDir <path>` — optional; defaults to `./export-output`

Each run writes one owner-only (`0600`) timestamped file under an owner-only
(`0700` or stricter) output directory:

```text
<outputDir>/chatbot-export-YYYY-MM-DDTHH-mm-ss-sssZ.json
```

The JSON is nested as `chatbots → threads → messages → attachments`. It includes:

- chatbot prompts, credit configuration, allowed models, and timestamps
- thread titles and pseudonymized participant keys
- message content, branching relationships, model/reasoning metadata, per-message credit use, and timestamps
- attachment type, position, description, and timestamps

It excludes:

- `ChatUsageCredits`, disclaimer, MCP, user, course, and participant records
- chatbot API credentials, base URLs, avatar, and owner/course/disclaimer relations
- attachment image and preview base64 payloads

Chatbot, participant, thread, message, attachment, parent-message, and tool-call identifiers are deterministically replaced with export-local values such as `message_00001`. Model IDs remain unchanged because they are evaluation context rather than database or participant identities.

New output directories are created as `0700`. An existing output directory must
already be owner-only; the exporter never changes caller-owned directory
permissions. Existing output files and symlinks are never followed or
overwritten.

> [!WARNING]
> This output is **pseudonymized, not anonymized**. System prompts, thread titles, message/reasoning content, and attachment descriptions remain unchanged and can contain personal information. Use only an approved AI evaluation system and handle the artifact according to the applicable data-protection rules.

The command uses the same compile-time and runtime read-only Prisma guard as the
course exporter. It validates that every requested chatbot exists. If a
message's parent does not resolve inside that message's thread, the exported
`parentId` is `null` and `warnings.invalidParentReferences` records only the
affected export-local thread and message IDs; the unresolved source ID is not
emitted. This changes only the generated JSON and never updates database data.
Self-referencing and cyclic parent chains remain hard errors before the
artifact is written.

## Development

```bash
pnpm --filter @klicker-uzh/export check   # tsc --noEmit
pnpm --filter @klicker-uzh/export test     # vitest
pnpm --filter @klicker-uzh/export build    # rollup -> dist/ + both compiled CLIs
```
