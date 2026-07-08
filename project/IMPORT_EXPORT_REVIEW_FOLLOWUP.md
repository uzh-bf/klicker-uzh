# Follow-up Review: Element Import/Export Feature (Round 2)

**Repo:** `~/Documents/klicker-uzh` (branch `import-export-elements`, uncommitted working tree)
**Date:** 2026-07-07
**Basis:** Re-review against [IMPORT_EXPORT_REVIEW.md](IMPORT_EXPORT_REVIEW.md). This document records which of the original findings are now resolved and lists what is still not optimal, with severity and proposed fixes.

## TL;DR

Excellent progress. **All five ship-blockers and both high-severity availability issues from the first review are fixed**, and the two biggest didactic gaps (media not packaged, status imported verbatim) are now genuinely addressed — media is bundled and re-uploaded on import, and imported elements are forced to `REVIEW`. The package format was bumped to v2, a production preflight script and startup config assertions were added, and the test suite grew accordingly.

The remaining items are one **Medium** architectural concern newly introduced by the media-bundling work, plus a handful of **Low/Info** residuals. Nothing below is a hard blocker, but the Medium item should be fixed before production rollout.

---

## Status of the original findings

| ID | Original issue | Status | Evidence |
|----|----------------|--------|----------|
| SEC-1 | Zip-bomb inflation | ✅ Fixed | `lib/zip.ts` now passes `inflateRawSync(data, { maxOutputLength: uncompressedSize })`, verifies CRC-32 against the header, and rejects non-zero general-purpose flags and central/local metadata mismatches. |
| SEC-2 | Unbounded blob download | ✅ Fixed | `packageStorage.ts downloadElementImportPackage` calls `getProperties()`, deletes+rejects oversized blobs, and streams with a hard `readStreamWithLimit` cap. |
| SEC-3 | Hardcoded HMAC secret fallback | ✅ Fixed | Dedicated `IMPORT_EXPORT_TOKEN_SECRET`; `assertImportExportTokenSecretConfig()` throws at startup (`app.ts`) outside dev/test. |
| SEC-4 | Dead answer-collection download op | ✅ Fixed | `getAnswerCollectionDownloadLink` resolver, query field, schema type, and op file all removed. |
| SEC-5 | Preview renders unvalidated options | ✅ Fixed | `buildPreview` now runs `assertValidElementOptions` (the real `validateAndProcessElementOptions`) and returns processed options; failures surface as `IMPORT_INVALID_OPTIONS`. |
| SEC-7 | Rate limiter hid Redis outages | ✅ Fixed | Distinct `RATE_LIMIT_UNAVAILABLE_ERROR` + structured `logImportExportPackageEvent` on both exceed and failure. |
| CMP-1 | `pointsMultiplier` unbounded | ✅ Fixed | Schema `.min(1).max(MAX_ELEMENT_POINTS_MULTIPLIER)` **and** `validateElementInputs` integer 1–4 check; tests cover `5` and `1.5`. |
| CMP-2 | Export could exceed import limit | ✅ Fixed | `assertStoredZipSize` pre-check, per-JSON `MAX_IMPORT_EXPORT_JSON_BYTES` guard, and a final `buffer.length` check. |
| CMP-3 | Import transaction timeout | ⚠️ Mostly fixed | `$transaction` now sets `maxWait: 10_000, timeout: 60_000` — but see **NEW-1** (media I/O inside the transaction). |
| CMP-4 | Preview/import divergence | ✅ Fixed | Resolved with SEC-5; import re-runs `buildPreview` for validation parity. |
| DID-2 | Embedded media not packaged | ✅ Fixed | New `mediaStorage.ts`: first-party Klicker media is downloaded into the ZIP on export (with checksums) and re-uploaded under the importer's container on import, with URL rewriting; external/inaccessible media raise warnings. |
| DID-3 | Status imported verbatim | ✅ Fixed | Import forces `DB.ElementStatus.REVIEW`; `IMPORT_STATUS_NORMALIZED_TO_REVIEW` warning shown. |
| UX-1 | Cached links outlive SAS expiry | ✅ Fixed | `DownloadModal` caches `{downloadLink, filename, expiresAt}` and refetches when within 60 s of expiry. |
| UX-2 | Opaque "invalid file" errors | ✅ Fixed | Server returns machine-readable codes; `translatePackageMessage` maps them to i18n strings. |
| UX-3 | Download button active when empty | ✅ Fixed | Button `disabled` + tooltip when `selectedElementCount === 0`. |
| UX-4 | No client-side size pre-check | ✅ Fixed | `file.size > ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES` rejected in the dropzone. |
| UX-5 | Convoluted download state machine | ✅ Fixed | Replaced with a single `openDownloadModal` `useCallback`; `downloadElements` now holds the element array. |
| CQ-1 | Dead/duplicate API surface | ✅ Fixed | Duplicate `getElementDownloadLink` query, unused ops, and `ElementImportInput` type removed. |
| DID-1 | Tags silently dropped | 🟡 Partial | Still not transferred, but now surfaced via `IMPORT_TAGS_OMITTED` warning. Acceptable v1 behavior; see **RES-1**. |
| DID-4 | No dedup/provenance on re-import | 🟡 Partial | Provenance now persisted (`originalId` on elements/collections, per-user media dedup), but re-importing still creates duplicate elements. See **RES-2**. |
| SEC-6 | Unauthenticated local package routes | 🟡 Mitigated | Now fails closed: `assertImportExportPackageStorageConfig` forbids local storage outside dev/test. Residual **RES-3**. |
| CQ-2 | Hand-rolled ZIP parser | 🟡 Improved | Hardened (flags, CRC, metadata match, checksum test) but still bespoke and without fuzz tests. **RES-4**. |
| CQ-3 | Minor smells | 🟡 Partial | `readPositiveIntegerEnv` centralized in `importExportPackageConfig.ts`; rate-limit still matched by message string and `assertExpectedPackagePath` still returns a boolean. **RES-5**. |
| SEC-8 / CMP-6 | Info/positives | ✅ Documented | `source` IDs kept advisory-only (`getPackageSourceIdAsPrismaInt` comment: "must never be used to connect, update, or authorize"). |

---

## What is still not optimal

### NEW-1 (Medium) — External media uploads run inside the Prisma transaction
`importElementPackageBuffer` opens `ctx.prisma.$transaction(...)` at `elementImportExport.ts:1881` and then calls `uploadPackageMediaFiles` (`:1892`), which performs **Azure Blob uploads** — up to `MAX_IMPORT_EXPORT_MEDIA_FILES = 100` files of up to 5 MB each — before any DB writes, all while the interactive transaction is open.

**Impact:** slow external network I/O holds a database connection and an open transaction for its entire duration. Under concurrency this can exhaust the Prisma connection pool and, with large media sets, still breach the 60 s `timeout` — reintroducing a variant of the very problem CMP-3 aimed to close. It also widens the window for lock contention on the importer's rows.

**Fix:** upload media **before** opening the transaction (media blobs are content-addressed and idempotently deduped by `ownerId_originalId`, so pre-transaction upload is safe), collect the `sourceHref → newHref` replacement map, then open a short transaction that only does DB work (collection/element creation + URL rewriting). Keep the existing `createdMediaHrefs` cleanup on rollback. This preserves atomicity of the DB portion while removing external I/O from the transaction.

### RES-1 (Low) — Tags still not transferred
Personal tags remain intentionally omitted and only warned about (`IMPORT_TAGS_OMITTED`). This is a reasonable v1 stance (tags are owner-scoped taxonomy), but it is a real loss for question-bank sharing between colleagues.
**Fix (post-GA):** offer opt-in tag import that `connectOrCreate`s tags under the importing user, or map to a dedicated "imported" tag. Document the current behavior in lecturer-facing docs.

### RES-2 (Low) — Re-import still duplicates elements
Provenance is now stored, but importing the same package twice still creates a second set of elements (answer collections likewise, though media dedups per user). `originalId` is written but never consulted to skip/update existing imports.
**Fix (post-GA):** on import, detect elements whose `originalId` already exists for the user and offer skip/update, or warn on name/provenance collision — the data to do this is now present.

### RES-3 (Low) — `originalId` reuses foreign-instance numeric IDs for answer collections
Imported answer collections persist `originalId = getPackageSourceIdAsPrismaInt(collection.source)`, i.e. the **exporting instance's** collection ID. That column is also used by the native copy feature and the `isImported` flag (`resources.ts:383`, `sharing.ts` catalog import-count query). A foreign ID injected into the importer's own ID-space can collide with locally meaningful IDs and skew "times imported" counts. No unique constraint exists on `AnswerCollection.originalId` (the `@@unique([ownerId, originalId])` is on `MediaFile`), so there is **no hard failure** — only a semantic muddying.
**Fix:** for cross-instance imports, prefer a namespaced/string provenance marker (as elements already do with the `import-package:<hash>:<ref>` fallback) rather than reusing a foreign integer ID, or leave `originalId` null for package imports and record provenance separately.

### RES-4 (Low) — Bespoke ZIP parser still lacks fuzz tests
The parser is materially hardened (rejects non-zero flags, unsupported methods, CRC mismatch, and central/local metadata divergence, with a dedicated checksum test), but it remains hand-written binary parsing with only example-based tests.
**Fix:** add property/fuzz tests over `parseZip` (truncated buffers, corrupted headers, oversized declared sizes) to lock in the guarantees.

### RES-5 (Low/Info) — Minor code smells remain
- Rate-limit control flow is still driven by matching an error **message** string rather than a typed error.
- `assertExpectedPackagePath` still returns a boolean despite the `assert` prefix (now also handling the `media/` folder).
**Fix:** introduce a typed `RateLimitError`; rename to `isExpectedPackagePath`.

### RES-6 (Info) — Fixed-window rate limiting
The per-bucket counter still permits up to 2× burst across a window boundary. Acceptable for this feature's abuse profile; note only.

---

## Path to production (updated)

- **Before rollout:** fix **NEW-1** (move media upload out of the transaction).
- **Ops (verify, mostly in place):** `IMPORT_EXPORT_TOKEN_SECRET` + Azure creds provisioned (asserted at startup); run `scripts/importExportProductionPreflight.ts` with `IMPORT_EXPORT_PREFLIGHT_SAS_ROUNDTRIP=true`; confirm blob **CORS** allows SAS PUT/GET from the frontend origin; Azure lifecycle policy on `klicker-import-export`; Hatchet `cleanup-import-export-packages` cron deployed (now also prunes orphaned `imported/` media). All are captured in the updated `CODEBASE_NOTES.md`.
- **Post-GA follow-ups:** RES-1 (tags), RES-2 (re-import dedup), RES-3 (provenance ID hygiene), RES-4 (ZIP fuzz tests).

**Overall:** the feature moved from "not production-ready" to "one Medium fix away from production-ready." Strong iteration.
