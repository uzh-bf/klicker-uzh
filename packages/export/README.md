# @klicker-uzh/export

Standalone, **read-only** CLI that exports a single course's (or several courses') live-quiz data to CSV + XLSX for offline analysis.

It is **not** imported by any app and **not** part of any deployment — it is run manually by an operator, on demand. The only production contact is pointing it at a read-only production `DATABASE_URL`.

## Scope

Exports **live-quiz data only**:

- `LiveQuizResponse` — one row per response
- `Participation` — enrolled participants
- `ParticipantInvitation` — invitations
- `AppliedPointCorrection` — lecturer point corrections (audit)
- plus two dimension sheets: live quizzes and element instances

It does **not** include practice-quiz / microlearning `QuestionResponse`, `QuestionResponseDetail`, or `GroupActivityInstance`. The scope (included/excluded models) is recorded in every export's `manifest.json` so a course with those activity types is not mistaken for "fully exported".

## Usage

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

## Output

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

### Sheets and join keys

| Sheet               | Join key                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `RESPONSES`         | `liveQuizResponseId` (PK); `elementInstanceId` → `ELEMENT_INSTANCES` |
| `PARTICIPANTS`      | `participantId` (PK)                                                 |
| `INVITATIONS`       | `participantId`                                                      |
| `CORRECTIONS`       | `liveQuizResponseId` + `elementBlockExecution` → `RESPONSES`         |
| `LIVE_QUIZZES`      | `liveQuizId` (includes zero-response quizzes)                        |
| `ELEMENT_INSTANCES` | `elementInstanceId` (full untruncated content + point config)        |

`RESPONSES` carries both the raw `response` JSON and flattened `response_choices` / `response_value` / `response_selection` / `response_assessment` columns so analysts can avoid parsing JSON.

## Safety

- **Read-only DB access** — `createReadonlyClient` narrows the Prisma client to read operations at compile time, and a runtime `$allOperations` guard blocks every non-read operation, including raw queries (`$queryRaw` / `$executeRaw` / `…Unsafe`).
- **PII modes** — default `full` writes identifiers verbatim (with a loud stderr warning); `--pseudonymize` hashes email / SSO id+email / matriculation number (per-run HMAC-SHA256 salt, never persisted) and redacts free-text answers and raw response JSON.
- **CSV** — UTF-8 BOM, one physical line per row (embedded newlines normalized), formula-injection escaping (`= + - @`).
- **Integrity** — `manifest.json` records per-file SHA-256, counts, package version, PII mode, scope, and a data dictionary for the cryptic + flattened columns.

Output directories contain PII and are gitignored.

## Development

```bash
pnpm --filter @klicker-uzh/export check   # tsc --noEmit
pnpm --filter @klicker-uzh/export test     # vitest
pnpm --filter @klicker-uzh/export build    # rollup -> dist/ + dist/scripts/export-course.js
```
