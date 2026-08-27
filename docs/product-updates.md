---
type: Product Updates
title: Product Updates
description: The repository-managed update catalog, how eligibility is selected, and the editorial rules the validation suite enforces.
timestamp: '2026-08-27'
tags:
  - architecture
  - frontend
---

# Product Updates

**Announcement content is code, and a feature flag decides only whether an
entry may be shown — never what it says.** The catalog is editorial content
reviewed in the same pull request as the feature it describes, so an entry
cannot drift away from the capability it announces. The decision and the
rejected alternatives are in
[ADR 0028](./adr/0028-native-product-updates-subsystem.md).

## The catalog package

`@klicker-uzh/product-updates` (`packages/product-updates`) is rollup-built,
React-free, and has no runtime dependencies. That constraint is not stylistic:
`apps/docs` is a Docusaurus site with its own React pin and no mechanism for
transpiling workspace TypeScript, so it can only consume a built plain-JavaScript
package. The same package serves the Next.js applications and the Node backend.

| Export                       | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `PRODUCT_UPDATES`            | The catalog itself, newest entry first                                  |
| `ProductUpdate`              | The entry contract, including the `LocalizedText` shape                 |
| `selectEligibleUpdates`      | Filters entries for one actor on one surface                            |
| `selectLatestReleasedUpdate` | Newest released entry for a surface with no actor, such as the homepage |

`FeatureFlagKey` is imported type-only from `@klicker-uzh/feature-flags`, so the
built output carries no dependency on it. The validation suite does read
`FEATURE_FLAG_DEFAULTS` at runtime, which is why CI builds the flag package
before running the catalog tests.

## Selection semantics

`selectEligibleUpdates` is pure and keeps the catalog's order. An entry is
eligible when the actor's audience and the current surface are both listed, the
current time is at or after `publishedAt` and before `expiresAt`, and every key
in `requiredFeatureFlags` evaluates to exactly `true`.

A flag that is absent from the passed evaluation counts as off. This is
deliberate: the flag registry's own fallback is `false`, so an unevaluated flag
must not accidentally reveal an announcement for a capability the actor cannot
use. Entries **without** `requiredFeatureFlags` are always eligible, which is
what lets a flag be retired without erasing the entry that announced it.

`suppressInAssessment` removes an entry when the caller passes
`isAssessment: true`. The assessment build of the PWA is a separate build of the
same application, detected through `NEXT_PUBLIC_IS_ASSESSMENT`.

## Editorial rules the tests enforce

`packages/product-updates/test/catalog.test.ts` is the catalog's CI contract, not
a unit test of application logic. It fails the build when an entry:

- reuses an id, or breaks the newest-first ordering;
- carries a `publishedAt` or `expiresAt` that is not a full ISO-8601 UTC
  instant, or expires before it was published;
- leaves either the German or the English side of any localized text empty;
- names a feature flag that is not in `FEATURE_FLAG_DEFAULTS`;
- uses a maturity, audience, surface, or promotion outside the known set;
- links a call to action somewhere other than an internal path or an `https` URL;
- puts a GFM table into `bodyMarkdown`. `@klicker-uzh/markdown` has remark-gfm
  commented out, so a table would reach the reader as literal pipes.

Two rules the tests cannot check, and reviewers must: the catalog is
**append-only** — an entry that should stop appearing gets an `expiresAt`
instead of being deleted — and `requiredFeatureFlags` must be removed from an
entry _before_ the corresponding GrowthBook flag is deleted.

Maturity is `released`, `preview`, or `pilot`. Planned work never enters the
catalog; it belongs in the roadmap or the Community.

## Localized content deviates on purpose

Entries use `{ de, en }` objects rather than the `nameDE`/`nameEN` field pairs
used elsewhere, and rather than the shared message files in
`packages/i18n/messages/`. Catalog copy is reviewed as a German/English pair by
the person shipping the feature, and the suite enforces that neither side is
missing — a missing i18n key would only render a placeholder. Do not migrate
other code to this shape; conversely, the chrome around an entry (feed title,
empty state, button labels) does belong in the i18n message files.

## Per-actor read state

`UserProductUpdateState` and `ParticipantProductUpdateState`
(`packages/prisma/src/prisma/schema/productUpdate.prisma`) hold one row per actor
and entry. Why the state is in the database, split across two tables, and keyed
per entry is recorded in
[ADR 0028](./adr/0028-native-product-updates-subsystem.md).

`updateId` is a plain string with no foreign key, since the catalog is code, so
the service validates every id against `PRODUCT_UPDATES` before writing.

| Column                                 | Meaning                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| `firstPresentedAt` / `lastPresentedAt` | When the entry first and most recently reached the actor   |
| `presentationCount`                    | How often a presentation was explicitly recorded           |
| `readAt`                               | When the card was first opened, and never moved afterwards |
| `dismissedAt`                          | When the actor dismissed the entry                         |

A row can be created by a read or a dismissal that arrives before any
presentation was recorded. The presentation timestamps are not nullable, so they
are filled with that moment, while `presentationCount` stays at zero because no
presentation was reported.

## The read-state API

Four authenticated root fields in `packages/graphql/src/schema/productUpdates.ts`
(type) plus the query and mutation types, backed by
`packages/graphql/src/services/productUpdates.ts`:

| Operation                                   | Behavior                                                             |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `productUpdateStates(updateIds)`            | Existing rows only; a missing entry means never presented and unread |
| `markProductUpdateRead(updateId)`           | Sets `readAt` once; a second read returns the unchanged row          |
| `dismissProductUpdate(updateId)`            | Sets `dismissedAt` once, in the same idempotent way                  |
| `recordProductUpdatePresentation(updateId)` | Upserts and increments `presentationCount`, moving `lastPresentedAt` |

An id that is not in the catalog is ignored by `productUpdateStates`, which
answers for the remaining ids, but rejected by all three mutations. That
asymmetry keeps a newer frontend's feed working against a backend that does not
carry the newest entries yet, while still refusing to write an orphaned row.

These are the only fields in the schema that serve lecturers and participants
under one name. Pothos' `role` scope takes a single role, so they are authorized
as `{ authenticated: true }` and the service performs the role branch: `USER` and
`ADMIN` write the lecturer table, `PARTICIPANT` writes the participant table, and
every other role — `TEMPORARY_PARTICIPANT` above all — is rejected with an error
rather than served an empty result. The actor id always comes from `ctx.user.sub`;
no operation accepts an actor id from the caller.

The three mutations additionally apply the repository's scope floor for writes:
a delegated lecturer login with `READ_ONLY` or `SESSION_EXEC` scope is rejected,
while the query stays open to it so the feed still renders. Participant tokens
carry no scope claim, so the floor applies to lecturer sessions only.

The write path comes in two shapes, both safe under two browser tabs touching
the same entry at once. `recordProductUpdatePresentation` is a single upsert
with a database-side increment, so no presentation is lost to a
read-modify-write race. `markProductUpdateRead` and `dismissProductUpdate`
insert the row if it is absent and then claim the timestamp only while it is
still unset: the insert is an upsert, so it cannot collide on the unique
constraint, and the second statement keeps the first read and the first
dismissal from moving.

## Current consumers

The documentation homepage banner
(`apps/docs/src/components/landing/TitleImage.tsx`) renders the newest released
entry for the `docs` surface. `apps/docs` had no workspace dependency before
this, so its build — including the deployment pipeline outside this repository —
must build the catalog package first. `turbo.json` covers the local `dev:docs`
task and the four application dev tasks.

The in-app feed surfaces in `frontend-manage` and `frontend-pwa` do not exist
yet; ADR 0028 describes their intended shape. The read-state API above is
already in place for them.
