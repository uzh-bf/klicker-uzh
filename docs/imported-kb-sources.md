# Imported knowledge-base sources

Imported sources let owners inspect content already indexed outside the managed upload lifecycle, including video-derived content without an original video blob. `KBImportedSource` records metadata separately from `KBResource`. Registration does not download sources, ingest content, change vectors, or replace citation identities.

## Identity and display

Each entry belongs to one KB and preserves its observed database, collection, identity field and identity value. Use `source_id` for an original source identifier or `video_source_id` for video-level identity. Group video segments by their original video identifier; keep timestamps in the existing retrieval records. Never derive identity from a title or segment URL.

The owner-only paginated query exposes title, kind, optional original link and observation/ingestion times. Missing ingestion time stays unknown. The observation is metadata provenance, not a fresh retrieval-health assertion. Original links permit HTTP(S), without credentials, query strings or fragments. Omit links that cannot meet this restriction.

Imported entries consume no managed resource slots or storage quota. They are excluded from managed ingestion, retry, replacement and graph-build inputs. Normal uploads continue using their KB ID and existing ingestion routing. Registering metadata cannot repair a mismatched reader/writer target; verify that independently before live acceptance.

## Operator registration

Run offline validation from `packages/graphql` with dependencies available:

```sh
pnpm exec tsx src/scripts/registerImportedKbSources.ts --manifest /path/to/reviewed-manifest.json
```

The version-1 manifest contains `kbId`, `expectedOwnerId`, `databaseName`, `collectionName` and `sources`. Each source requires `sourceIdentityField`, `sourceIdentityValue`, `title`, `kind` and `observedAt`; `projectId`, `producerId`, `sourceUrl` and `ingestedAt` are optional. Kinds are `DOCUMENT`, `LINK`, `VIDEO` and `IMAGE`. Unknown fields, duplicate identities and unsafe URLs are rejected. Store reviewed manifests outside Git; include metadata only, never transcripts, video files, chunks or credentials.

Offline validation emits a canonical fingerprint and count without loading Prisma. Apply requires both `--apply` and the exact reviewed `--fingerprint`. Use the approved environment-specific secret injection around the same CLI; do not rely on a default development script to select a live target.

Application locks the target KB, checks its expected owner and non-deleted state, compares every existing identity before inserting, and commits atomically. Exact replay is a no-op, preserving creation timestamps. Changed metadata or conflicting identity fails the entire batch. Omitted sources are retained. This utility has no deregistration operation.

## Deletion and live acceptance

Whole-KB deletion returns `KB_IMPORTED_SOURCES_PRESENT` while imported entries exist. Maintenance excludes those KBs from hard deletion, and the foreign key restricts accidental deletion. Supported imported-source cleanup must be designed before removing entries or their KB; deleting metadata would not remove indexed content.

Source delivery does not authorize live registration. After deployment, review a scoped inventory for the target owner and KB, validate its manifest offline, approve the exact target and fingerprint, then apply once and read back the owner UI. Confirm source counts and representative video/document entries, existing citation behavior, and a separate synthetic upload into the intended collection and KB scope. Preserve working corpora throughout verification.
