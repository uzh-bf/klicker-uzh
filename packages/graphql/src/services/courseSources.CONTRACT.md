# Video source directory contract, v1

Klicker owns lecture video source approval: sources, approval requests,
personal links, the audit chain, e-mails and pages. It does not know where an
institution keeps its course catalogue or recordings. It calls a provider
through this contract. This module is the UZH provider. The authoritative
copy of the contract sits beside Klicker's client; change both together.

All endpoints take and return JSON, require
`Authorization: Bearer <COURSE_SOURCES_TOKEN>` and accept at most 16 KiB.
Dates are ISO 8601 strings. `GET /healthz` is open and returns
`{status: "ok", contractVersion: 1}`.

## Shared shapes

```ts
type SourceLink = {
  kind: string // provider-defined; UZH: 'OLAT_NODE' | 'KALTURA_CHANNEL'
  externalRef: string // the id the link names (OLAT node, channel category)
  fixedCollectionId: string | null // set when the link names the Kaltura category
}

type Period = {
  label: string // stable, stored and shown by Klicker, e.g. 'HS26'
  start: string // inclusive
  end: string // exclusive; Klicker sets validUntil to this
}

type Recipient = {
  name: string
  email: string
  roles: Array<'RESPONSIBLE' | 'LECTURER'>
}

type Directory = {
  canonicalUrl: string // directory link normalised to the period
  title: string
  shortName: string
  recipients: Recipient[] // one per distinct e-mail, responsible first
  withoutEmail: string[] // display names Klicker cannot reach
  warnings: string[]
  snapshot: object // opaque, contains personal data; store, hash, never log
}

type CollectionCandidate = {
  id: string // Kaltura category id
  name: string
  fullName: string
  createdAt: string
  entriesCount: number
  recordingsInPeriod: number
  latestRecordingName: string | null
  latestRecordingAt: string | null
  sampleRecordingNames: string[]
  recommended: boolean // at most one; the admin always confirms
}

type Actor = { userId: string; email: string | null }
```

## Endpoints

`POST /course-sources/v1/source-link` `{sourceUrl}` → `{source: SourceLink}`.
Klicker calls it when a source is created and rejects a confirmed collection
id that differs from a non-null `fixedCollectionId`.

`POST /course-sources/v1/directory` `{directoryUrl, period?: string | null}`
→ `{period: Period, directory: Directory}`. Klicker calls it when it sends an
approval request and stores the result as the request's recipient snapshot.
The period is the explicit label, else the one in the link, else the current.

`POST /course-sources/v1/resolve`
`{sourceUrl, directoryUrl, period?: string | null, actor: Actor}` →
`{source, period, directory: Directory | null, directoryError: string | null,
collections: CollectionCandidate[], collectionsError: string | null}`. This is
the admin setup preview. The two halves fail independently. `actor` is passed
to the ingestion gateway for its audit of the Kaltura lookups.

## Errors

| Status | `code`                                                            | Meaning                         |
| ------ | ----------------------------------------------------------------- | ------------------------------- |
| 400    | `INVALID_REQUEST`                                                 | Missing or mistyped fields      |
| 401    | `UNAUTHORIZED`                                                    | Wrong or missing service token  |
| 413    | `REQUEST_TOO_LARGE`                                               | Body over 16 KiB                |
| 422    | `INVALID_SOURCE_LINK`, `INVALID_DIRECTORY_LINK`, `INVALID_PERIOD` | Input an admin can correct      |
| 422    | `NOT_OFFERED`                                                     | No such course in that period   |
| 502    | `DIRECTORY_UNEXPECTED`                                            | Catalogue answered unexpectedly |
| 503    | `DIRECTORY_UNAVAILABLE`                                           | Catalogue unreachable           |

Error bodies are `{code, message}`; `message` is safe to show to an admin.

## Without a provider

Klicker stays usable: the admin enters recipients, the period label and end,
and the Kaltura category id by hand. No link is parsed and no lookup is made.
