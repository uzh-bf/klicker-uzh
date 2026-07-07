# Review: Element Import/Export Feature

**Scope:** commits `0fd8102a6..656785958` on branch `import-export-elements` / `claude/quizzical-chandrasekhar-00bcdf` (~7.5k added lines).
**Date:** 2026-07-07
**Reviewer note:** Senior-engineer peer review requested across didactics/psychometrics, computations, security, UX, code quality, and the path to production. This is an assessment document only — no code was changed. Findings reference `file:line` against the working tree at review time.

## 1. Summary & Verdict

The feature lets a lecturer export selected elements (and their linked answer collections) as a portable ZIP package, and import such a package into their own element pool. The design is genuinely security-conscious and the happy path is well built.

**Architecture at a glance:**

1. **Export** — `getElementExportPackageLink` gathers WRITE+ elements/collections, serializes each to JSON, builds a ZIP in memory (`lib/zip.ts createZip`), uploads it to a private per-user blob (`exports/<userId>/…`), and returns a short-lived read SAS URL.
2. **Import upload** — `prepareElementImportPackageUpload` returns a write-only SAS URL for `imports/<userId>/…`; the browser PUTs the file directly to blob storage.
3. **Validate** — `validateElementImportPackage` downloads the blob, parses/validates the ZIP with a custom parser + strict zod schemas, builds a render preview, and returns an **HMAC-signed import token** binding `{blobName, sha256(buffer), userId, expiresAt}`.
4. **Import** — `importElementPackage` verifies the token, re-downloads, re-hashes and compares against the token, then creates collections + elements inside a single Prisma transaction via the shared `manipulateElement` service.

**Verdict:** Strong foundation, **not yet production-ready.** Two high-severity availability issues (zip-bomb inflation, unbounded blob download), one high-severity correctness issue (`pointsMultiplier` bound), a hardcoded secret fallback, and a piece of dead, weaker-authz API surface should be resolved before rollout. Several didactic gaps (tags, embedded media) are acceptable for a v1 but must be documented and warned about, not left silent.

**Severity scheme:** Critical (exploitable data loss/breach, ship-blocker) · High (security/correctness ship-blocker) · Medium (should fix before GA) · Low (polish / post-GA) · Info (note / positive).

---

## 2. Security

**Done well:** validate→import binding via HMAC token + sha256 re-check (`elementImportExport.ts:1126`, `:1243`) prevents TOCTOU tampering between preview and import; per-user blob prefixes enforced on every download (`packageStorage.ts:267` `assertUserPackageBlob`); all zod schemas are `.strict()`, rejecting unknown keys; ZIP paths are validated against traversal/absolute paths (`zip.ts:38`); rate limiting fails closed; import runs option processing through the same whitelist (`validateAndProcessElementOptions`) as normal element creation, so no unvetted `options` shape reaches the DB.

### SEC-1 (High) — Zip-bomb / decompression DoS
`lib/zip.ts:213` calls `inflateRawSync(compressedData)` with no output cap, and the sanity check `data.length !== uncompressedSize` (`zip.ts:220`) only runs *after* the buffer is fully inflated in memory. The declared sizes in the central directory are attacker-controlled and the `maxUncompressedBytes` accumulator (`zip.ts:173`) trusts those declared values, not the actual output. A ~10 MB DEFLATE payload can expand on the order of gigabytes (deflate ratio ≈ 1032:1), OOM-ing the backend during `validateElementImportPackage`.
**Fix:** pass `inflateRawSync(compressedData, { maxOutputLength: uncompressedSize })` (supported by Node's zlib) so inflation aborts early, and keep the post-check to reject packages whose actual size differs from the declared size. Add a running cap on cumulative *actual* inflated bytes.

### SEC-2 (High) — Unbounded blob download before size enforcement
`packageStorage.ts:404` `downloadElementImportPackage` calls `blobClient.downloadToBuffer()` and only afterwards does `parseElementImportPackage` check `buffer.length > MAX_PACKAGE_BYTES` (`elementImportExport.ts:404`). The upload SAS is granted with `permissions: 'cw'` (`packageStorage.ts:326`), which cannot enforce a maximum blob size, so a user can PUT a multi-GB blob and cause an OOM the moment they call validate.
**Fix:** call `blobClient.getProperties()` and reject when `contentLength > MAX_PACKAGE_BYTES` before downloading; also cap the local test route (currently `express.raw({ limit: '12mb' })` in `app.ts`, which is fine locally but the Azure path has no equivalent).

### SEC-3 (Medium) — Hardcoded HMAC secret fallback
`elementImportExport.ts:346` `getTokenSecret()` falls back to the literal `'development-import-export-secret'` when `APP_SECRET`, `NEXTAUTH_SECRET`, and `BLOB_STORAGE_ACCESS_KEY` are all unset. The blast radius is limited (the token still embeds `userId`, and the blob prefix is re-checked on download), but a misconfigured production deployment would silently degrade the validate→import integrity binding to a known-key HMAC.
**Fix:** fail fast at startup (throw) when no real secret is configured and `NODE_ENV` is not `development`/`test`.

### SEC-4 (Medium) — Dead answer-collection download op with weaker authorization
`sharing.ts getAnswerCollectionDownloadLink` (added ~`sharing.ts:6907`) and its query `getAnswerCollectionDownloadLink` in `schema/query.ts` are authorized as `asUser` — **not** `asUserFullAccess` like the element export queries — carry **no rate limit**, and check only the `permissions` relation (missing `directPermissions`, unlike `exportPermissionFilter` at `elementImportExport.ts:70`). They emit raw answer-collection JSON with database IDs in a shape that cannot be re-imported, and there is **no frontend consumer** (`grep` for `GetAnswerCollectionDownloadLinkDocument` returns nothing). It is inconsistent attack surface with no user.
**Fix:** delete the resolver, the query field, and `QGetAnswerCollectionDownloadLink.graphql`. If a standalone answer-collection export is actually wanted, rebuild it on the package format with matching scope/rate-limit/permission filter and a corresponding import path.

### SEC-5 (Medium) — Preview renders unvalidated `options`
The package element schema declares `options: z.record(z.unknown())` bounded only by size (`elementImportExport.ts:164`, `assertOptionsSize` ≤ 200 KB). `validateElementImportPackage` passes this raw object straight back through the GraphQL `Json` scalar into `StudentElementPreview`/Formik on the client. Import itself is safe (options are re-derived by the type-specific whitelist), but the **preview** trusts arbitrary package-authored structure, so a malformed package can crash or garble the preview, and — more importantly — the preview can show something different from what will actually be stored (see CMP-4).
**Fix:** run the per-type option validation server-side during `validate`, build the preview from the *processed* options, and push any element that fails validation into the `errors`/`warnings` arrays instead of returning it as previewable.

### SEC-6 (Low) — Unauthenticated local package HTTP endpoints
`app.ts` registers `PUT`/`GET /api/import-export-packages/:blobName` with no authentication. They are gated behind `isLocalImportExportPackageStorageEnabled()` (`NODE_ENV === 'test'` and storage ≠ azure), which is acceptable for the local/test harness, but any user can read any other user's package while that mode is on, and a `NODE_ENV` misconfiguration would expose it in a deployed environment.
**Fix:** keep the gate, but require an explicit opt-in flag (e.g. a dedicated env var) and/or apply the same `assertUserPackageBlob`-style ownership check on the encoded blob name even in test mode.

### SEC-7 (Low) — Rate limiter conflates Redis outage with limit exceeded
`assertImportExportRateLimit` (`elementImportExport.ts:201`) wraps the whole Redis interaction in a try/catch that rethrows `RATE_LIMIT_ERROR` for *any* failure. Failing closed is the right call, but it hides real Redis outages behind a "too many requests" message and gives no operational signal. The fixed-bucket window (`Math.floor(Date.now() / window)`) also permits up to 2× burst across a bucket boundary.
**Fix:** log the underlying error and return a distinct "temporarily unavailable" message for infrastructure failures; consider a sliding-window counter if boundary bursts matter.

### SEC-8 (Info) — Internal DB IDs embedded in packages
Packages embed `source.id`/`source.version` and derive refs like `element-<id>` / `answer-collection-<id>-entry-<id>` (`elementImportExport.ts:863`, `:990`). These leak internal identifiers but are deliberately ignored on import (verified by the "ignores spoofed source ids" test) and refuse raw DB item IDs in case-study solutions (`getElementEntryRefs`, `mapCaseStudySolutionRefsToItemIds`). Acceptable — document that `source` is advisory only.

---

## 3. Computations & Correctness

**Done well:** export preserves element order and de-duplicates IDs (`elementImportExport.ts:817`); SELECTION/CASE_STUDY answer-collection references are mapped id↔ref on both directions with an explicit refusal to carry raw DB `itemId`s in packages (`getElementEntryRefs:601`, `mapCaseStudySolutionRefsToItemIds:660`); the sha256 binding guarantees the imported bytes equal the validated bytes.

### CMP-1 (High) — `pointsMultiplier` is effectively unbounded
The package schema accepts any positive integer (`elementImportExport.ts:165` `z.number().int().positive()`) and the shared `validateElementInputs` only checks `pointsMultiplier > 0` (`validateElementInputs.ts:104`), while the authoring UI constrains the value to 1–4. An imported element can therefore carry a multiplier of, say, 10⁹, inflating grading, XP, and leaderboard scores in every activity that later uses it. The gap is latent in `manipulateElement` already, but import makes crafting such an element trivial and bypasses the UI entirely.
**Fix:** add `.max(4)` (or the canonical maximum) to the package schema **and** enforce the 1–4 bound in `validateElementInputs` so there is a single server-side source of truth rather than a UI-only constraint.

### CMP-2 (Medium) — Export can produce packages that fail their own re-import
`createZip` writes every entry with the STORE method (no compression, `zip.ts:66/84`), and the export path never checks its own output against `MAX_PACKAGE_BYTES` / `MAX_JSON_BYTES`. With `MAX_ELEMENTS = 100`, each element allowing up to 200 KB of content plus 200 KB of options, a large legitimate export can exceed the 10 MB import ceiling and become non-importable — the round-trip guarantee silently breaks at scale.
**Fix:** compress entries with DEFLATE on export (the parser already supports method 8), and/or validate the produced package size and tell the user to export in smaller batches.

### CMP-3 (Medium) — Import transaction may exceed Prisma's default timeout
`importElementPackageBuffer` runs up to 100 `manipulateElement` calls — each doing validation, an `upsert`, and `recomputeDerivedPermissions` — plus collection creation, inside a single `ctx.prisma.$transaction(async …)` with no `timeout`/`maxWait` options (`elementImportExport.ts:1277`). Prisma's default interactive-transaction timeout is 5 seconds; a full 100-element import can plausibly blow past that and roll back with an opaque error.
**Fix:** pass an explicit `timeout` sized for `MAX_ELEMENTS`, or chunk the import into smaller transactions with a documented partial-failure story.

### CMP-4 (Low) — Preview diverges from what is stored
`validateAndProcessElementOptions` strips fields on write (e.g. `hasAnswerFeedbacks` when there is no sample solution, and any unknown keys), but the preview is built from the raw package options. What the lecturer approves in the preview is not guaranteed to be what lands in the DB. Resolved together with SEC-5 (build the preview from processed options).

### CMP-5 (Low) — Answer-collection entry mapping relies on value uniqueness
`importElementPackageBuffer` maps freshly-created entries back to package refs by matching on `value` equality (`elementImportExport.ts:1315`). This is only correct because duplicate entry values within a collection are rejected earlier (`validatePackageDependencies:534`). The invariant is load-bearing but implicit.
**Fix:** add a comment pinning the dependency and a regression test asserting that duplicate values are rejected before import mapping.

### CMP-6 (Info) — Correct handling worth keeping
The id↔ref translation, order preservation, and sha256 validate/import binding are correct and well tested; keep them.

---

## 4. Didactics & Psychometrics

**Done well (DID-5, Info):** the psychometrically meaningful content survives the round trip — sample solutions, per-answer feedback (only retained when a sample solution exists), explanations, `basePoints`, the points multiplier, and SELECTION/CASE_STUDY answer mappings. Response data and per-participant statistics are correctly **not** exported, which is the right privacy stance.

### DID-1 (Medium) — Tags are silently dropped
Export never serializes tags, and import hardcodes `tags: []` in `buildElementManipulationArgs` (`elementImportExport.ts:1183` and the other two branches). Tags are the primary taxonomy of a question bank — a core organizational/didactic asset — and losing them on every transfer degrades the shared material with no notice to the user.
**Fix:** include tags in the package format (an optional field avoids a version bump), or at minimum surface a UI warning ("tags will not be transferred") and document it.

### DID-2 (Medium) — Embedded media is not packaged
Element `content` is markdown that can embed absolute URLs into the exporter's public per-user blob container (`getFileUploadSas` creates the container with `access: 'blob'`, `elements.ts:1127`; hrefs are `…/<userId>/<uuid>.<ext>`). Imported elements therefore hotlink the *original owner's* storage: images break if that owner deletes the file or their account, and the importer never actually owns the media they appear to have received.
**Fix (staged):** first, detect blob URLs in exported/imported content and warn the user; later, bundle referenced media into the ZIP and re-upload it under the importer's container, rewriting the URLs on import.

### DID-3 (Low) — Element status is imported verbatim
Packages can carry `status: READY`; imported-but-unreviewed elements then appear production-ready in the pool, undermining the draft→review→ready QA workflow that the status field exists to support.
**Fix:** offer an import option "mark all imported elements as REVIEW" (default on), or at least show provenance so reviewers know an element arrived via import.

### DID-4 (Low) — No dedup or provenance on import
Because source IDs are (correctly, for security) ignored, re-importing the same package always creates fresh duplicate elements *and* answer collections. Iterative sharing between colleagues quickly pollutes the pool.
**Fix:** warn on name collisions at import time; longer term, persist lightweight provenance (package hash / source ID) to enable "update existing" semantics.

---

## 5. UX

**Done well (UX-6, Info):** the import flow previews every element before commit with per-element toggles and a faithful student-view render (`ImportedElementsOverviewTable` + `StudentElementPreview`); answer collections are summarized in both directions (`PackageAnswerCollectionOverview`); the layout is mobile-aware; de/en i18n is complete; `data-cy` coverage is thorough and backed by 6 Playwright E2E flows.

### UX-1 (Medium) — Cached download links outlive their SAS expiry
`DownloadModal` caches generated links in `seenElementIds` keyed by `id:version` and reuses them indefinitely (`DownloadModal.tsx:54-66`), but the read SAS is only valid for 15 minutes (`packageStorage.ts:371`) and the returned `expiresAt` is never consulted. A lecturer who opens the modal, waits, and downloads gets an opaque fetch failure.
**Fix:** store `expiresAt` alongside the cached link and refetch when stale — or drop the cache entirely, since link generation is cheap and already rate-limited (30 / 15 min).

### UX-2 (Medium) — Almost every upload error collapses to "invalid file"
`UploadModal.handleFileUpload` maps every error except the exact upload-failed case to `elementImportInvalidFile`, and it does so by comparing `err.message` against a *translated* string (`UploadModal.tsx:237`). Rate-limit, oversize, and structural-validation errors are indistinguishable to the user, and the comparison breaks under a different locale.
**Fix:** return machine-readable error codes in `preview.errors` (the export side already does this with `ELEMENT_EXPORT_PERMISSION` / `ANSWER_COLLECTION_EXPORT_PERMISSION`) and map them to specific i18n messages on the client.

### UX-3 (Low) — Download button active with an empty selection
The toolbar Download button in `pages/index.tsx` opens the modal even when nothing is selected, landing the user in an empty-state modal instead of being disabled.
**Fix:** disable the button when `selectedElements` is empty.

### UX-4 (Low) — No client-side size pre-check
A >10 MB ZIP is uploaded in full before the server rejects it during validate.
**Fix:** check `file.size` in the dropzone `onDropAccepted` handler and reject early with a clear message.

### UX-5 (Low) — Convoluted download-open state machine
Opening the download modal goes through an `updatedElementsForDownload` flag plus a `useEffect` (missing `elements` in its dependency list) that refreshes the selection and then flips `downloadElements` (`pages/index.tsx`). This is a stale-closure risk and hard to follow.
**Fix:** replace with a single handler that computes the refreshed selection and opens the modal directly.

---

## 6. Code Quality & Tests

**Done well (CQ-4, Info):** the vitest suite (1055 lines) is genuinely strong — it covers strict ZIP structure validation, globally-duplicated refs, spoofed source IDs, WRITE+ export permissions, linked-collection permission gating, full-access scope enforcement, per-user rate limiting, and cleanup of expired blobs. Six Playwright E2E tests cover the real export→import round trip and permission edges.

### CQ-1 (Medium) — Dead / duplicate API surface
`schema/query.ts` exposes both `getElementDownloadLink` and `getElementExportPackageLink`, which resolve to the *same* service function. The ops `QGetElementDownloadLink`, `QGetAnswerCollectionDownloadLink`, and `QGetAnswerCollectionsInfoBasic` have no frontend consumers, and `ElementImportInput` in `packages/types/src/index.ts` is unused. Each is maintenance and (per SEC-4) attack surface.
**Fix:** remove the duplicate query, the unused ops/graphql files, and the unused type before rollout; keep only the single `getElementExportPackageLink` + `getElementExportPackagePreview` pair the UI actually calls.

### CQ-2 (Low) — Hand-rolled ZIP implementation
`lib/zip.ts` is a 235-line bespoke ZIP reader/writer. Its strictness is commendable (no ZIP64, path validation, central-vs-local path matching, unsupported-method rejection), but bespoke binary parsers are a classic bug reservoir.
**Fix:** keep it if the dependency-minimization is intentional, but add fuzz/property tests around `parseZip` (malformed headers, truncated data, mismatched sizes); otherwise adopt a vetted library (`fflate`/`yauzl`) behind the same guards.

### CQ-3 (Low) — Minor smells
`assertExpectedPackagePath` returns a boolean despite the `assert` prefix (`elementImportExport.ts:399`); `readPositiveIntegerEnv` is duplicated in `elementImportExport.ts` and `packageStorage.ts`; the rate-limit control flow is driven by matching an error *message* string; and `sharing.ts` left commented-out `select` fields in the new resolver.
**Fix:** rename to `isExpectedPackagePath`, hoist the env helper into a shared util, use a typed error class for rate limiting, and delete the commented code.

### CQ-4 (Info) — Test gaps to add
No coverage yet for: zip-bomb / oversize-blob inputs (SEC-1/2), `pointsMultiplier` bounds (CMP-1), a full 100-element transaction-scale import (CMP-3), or expired-link UX (UX-1). Add these alongside the fixes.

---

## 7. Path to Production

### Blockers (fix before rollout)
- **SEC-1** — cap inflation (`maxOutputLength`).
- **SEC-2** — check blob size before download.
- **CMP-1** — bound `pointsMultiplier` server-side.
- **SEC-3** — fail fast on missing HMAC secret in prod.
- **SEC-4 / CQ-1** — remove the dead, weaker-authz answer-collection download op and other dead surface.

### Should-fix before GA
- **CMP-2** — compress or size-check exports so they re-import.
- **CMP-3** — explicit transaction timeout / chunking.
- **SEC-5 / CMP-4** — validate options server-side; build preview from processed options.
- **UX-1** — respect SAS expiry on cached links.
- **UX-2** — machine-readable, locale-safe upload errors.

### Ops checklist
- Verify the **Azure Storage lifecycle policy** on the `klicker-import-export` container (defense-in-depth alongside the Hatchet cron; already flagged in `CODEBASE_NOTES.md`).
- Confirm the new env vars are wired in Infisical (they are already in `turbo.json globalEnv`).
- Ensure the Hatchet `cleanup-import-export-packages` cron is deployed and the general worker registers it.
- Add monitoring/alerts for rate-limit hits and validate failures (ties into SEC-7).
- Write lecturer-facing docs, **document the package format**, and define a `PACKAGE_VERSION` forward-compatibility / migration policy — currently only `version: 1` is accepted, which is fine internally but needs a story before third parties author packages.

### Post-GA follow-ups
- Media bundling (**DID-2**), tag transfer (**DID-1**), provenance/dedup (**DID-4**), status handling on import (**DID-3**), and the ZIP fuzz tests (**CQ-2**).
