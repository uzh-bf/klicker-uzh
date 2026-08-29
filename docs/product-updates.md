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

The lecturer feed in `frontend-manage` is described below. The student surface in
`frontend-pwa` does not exist yet; ADR 0028 describes its intended shape, and the
read-state API above is already in place for it.

## The lecturer feed

`apps/frontend-manage/src/components/productUpdates/` holds the whole surface.
`useProductUpdates` is its single entry point: it selects the catalog entries
eligible for audience `lecturer` on surface `manage`, pairs each with the stored
read state, and exposes the three write calls. Several components may call it at
once — the header and the `/updates` page do — because they share one Apollo
query, and every mutation writes its returned row back into that query's cache
entry instead of refetching.

Flags are evaluated through `useFeatureFlags` from `@klicker-uzh/feature-flags`,
which asks GrowthBook once per render for every key the catalog gates on. One
`useFeatureFlag` call per catalog entry would break the rules-of-hooks lint rule
as soon as the number of entries can change, so the hook count must stay
independent of the catalog length.

| Surface                                         | Shows                                                           |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Bullhorn in the header, before the support icon | Unread dot when an eligible entry is neither read nor dismissed |
| Feed modal behind the bullhorn                  | Eligible entries that are not dismissed                         |
| `/updates` page                                 | All eligible entries, including dismissed ones                  |

The unread dot comes from `NotificationBadgeWrapper` around the button rather
than the navigation item's own `notification` prop: the design system pins that
prop to `undefined` for icon-only buttons, so an icon-only navigation entry
cannot carry it.

A card reports both a presentation and a read once it actually enters the
viewport, through an `IntersectionObserver` guarded by a per-mount ref. Two
consequences are deliberate. Opening the feed does not mark entries below the
fold as read, which is the read semantics ADR 0028 requires. And because the feed
modal unmounts when it closes, `presentationCount` counts feed openings that
reached the card, not renders. Reporting waits until the stored states have
arrived, because that query response replaces the whole cached state array and
would otherwise discard the cache write of a mutation answered before it.

The `/updates` page also renders dismissed entries and reports a presentation on
every visit, so `presentationCount` includes archive-page impressions and keeps
growing on revisits — which matters for any spotlight cap that reads the counter.

Matomo receives the adoption funnel under the category `Product Update` with the
catalog id as the event name: `Eligible` once per page load per entry, then
`Presented`, `Opened`, `Dismissed`, `CTA Clicked`, and `Details Opened`, plus
`Spotlight Presented` and `Spotlight Dismissed` for the overlay described below.
Spotlight impressions stay separate from card impressions because they reach
lecturers who never opened the feed.

Entry copy always comes from the catalog in the reader's locale. Only the chrome
around it — feed title, empty state, dismiss and read-more labels, the
`preview`/`pilot` maturity labels, and the spotlight buttons — lives under
`manage.productUpdates` in `packages/i18n/messages/de.ts` and `en.ts`.

## The contextual spotlight

An entry with the promotion `spotlight` does not only wait in the feed: it
highlights the piece of the manage interface it announces, with the entry's own
title and summary in a Driver.js popover. This is the loudest promotion level
the subsystem has, so everything below exists to keep it rare.

### Targets are registry keys, not selectors

`apps/frontend-manage/src/components/onboarding/featureTargets.ts` maps every
legal `spotlightTarget` key to one element carrying
`data-product-feature="<key>"`. The same registry serves the onboarding tour
described below, which is why it lives outside the product-update folder. The
catalog never contains a CSS selector, and it must not: the catalog is editorial
content in a package that knows nothing about any application's markup, and a
selector written there would break silently the next time a component moves.

Adding a target therefore means two edits in the same pull request — a key in the
registry, and `featureTargetProps` spread onto exactly one element. Design
system components do not forward unknown attributes, so a wrapper element is
often the right place; the first registered target,
`manage-header-analytics`, wraps the header's analytics menu for that reason.

Resolving a key returns null both for a key this frontend does not know and for a
known key whose element is not on the current page. Both are normal — the catalog
can be newer than the deployed application, and a target lives on the page it
belongs to — so a spotlight that cannot find its element simply does not appear.

### Caps

`useProductUpdateSpotlight` runs the overlay. The manage header is the only mount
that may present unsolicited, because it renders on every page; every other
caller receives a replay-only instance. Four rules bound the unsolicited case:

| Rule                                                | Mechanism                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| At most one unsolicited overlay per browser session | The shared `sessionStorage` slot, claimed before the overlay opens |
| Never for an entry the lecturer dismissed           | `dismissedAt` from the stored read state                           |
| Never after two recorded presentations              | `presentationCount >= 2` from the same state                       |
| Never where it would interrupt time-critical work   | A route pattern match against `router.pathname`                    |

The route rule exists because Driver.js blocks pointer events on the whole
document while the overlay is open, which is unacceptable wherever a lecturer is
doing time-critical steering or grading work. Two routes qualify today:
`/quizzes/[id]/cockpit`, where the overlay would freeze the controls that
advance, evaluate, or end a running quiz, and
`/courses/[id]/assessment/liveQuiz/[quizId]`, where it would sit on top of the
point corrections. Both are matched before the session flag is claimed, so
leaving them for an ordinary page still shows the spotlight there. The rule
covers unsolicited appearances only; a replay stays available everywhere.

Two of these rules read stored state, so nothing is presented until that state is
known to be complete. A failed states query resolves with no rows, which looks
exactly like an actor who has never seen anything; treating that as permission
would bring a dismissed entry back. `useProductUpdates` therefore reports
`statesLoaded`, false while loading and false on error, and the runner waits for
it.

A browser session is one tab, because `sessionStorage` is per tab and clears when
it closes. A second tab can therefore cost one more appearance; the presentation
counter is what bounds the total. When storage is unavailable the guard cannot be
honoured, so nothing is presented at all rather than repeatedly. The slot is
shared with the onboarding tour, and the spotlight waits for the tour's decision
before claiming it — see below.

The unsolicited overlay opens one animation frame after the runner decides to
show it. A mount that is undone immediately — React's development double
invocation, or a layout that flips back to its loading state — therefore cancels
the appearance instead of spending the session's single spotlight on an overlay
that is torn down again in the same commit.

Presenting records a presentation, which is what makes the counter cap
self-limiting: two unsolicited appearances exhaust it without anyone acting.
Note that feed and `/updates` card impressions increment the same counter, so a
lecturer who browses the archive reaches the cap sooner.

The popover offers two decisions. "Show me" marks the entry read and follows the
entry's call to action when it has one. "Don't show again" calls
`dismissProductUpdate`, which suppresses every future unsolicited appearance.
Closing the popover with the corner icon means "not now" and changes no state.
Driver.js gives a one-step highlight three button slots, and since a single step
has nothing to go back to, the previous slot carries the dismissal.

Every string handed to the popover is HTML-escaped first, because Driver.js
writes popover text into the DOM with `innerHTML` while the same catalog text is
escaped by React in the feed card. Without escaping, a title such as
"Faster grading (<2s)" would lose part of itself to the HTML parser.

### Replays are always allowed

A card shows a "Show me where" button once its target actually resolves on the
page the card is displayed on, in the feed modal and on the `/updates` archive.
The button ignores both caps, because the lecturer asked for it — including for
an entry that was dismissed, which is why the archive keeps the button on
dismissed cards. A target that is not on this page hides the button rather than
offering a replay that would silently do nothing.

The header owns the runner, so a feed replay closes the modal first and opens the
overlay one animation frame later; the modal's focus trap and the popover would
otherwise fight over the page.

## Onboarding tours

A spotlight announces one feature. A tour orients someone who has just arrived:
several steps over the parts of an interface that are always on screen. Manage
has one today (`manage-onboarding-v1`); the student app and the chat app are
meant to follow, which is why the mechanics live in a package instead of next to
the manage header.

### The shared package

`packages/product-tours` has two entry points, and the split is load-bearing.
The default one is pure TypeScript with no React, no driver.js and no browser
APIs: it holds `TOUR_IDS`, `isKnownTourId` and `escapeHtml`, and it is what the
GraphQL backend imports to validate what a client claims to have finished. The
backend images therefore carry the package's build output, like the catalog
package. `./react` holds everything else — the tour hook, the shared session
slot, the deferred open, and the attribute-based target lookup each app builds
its own registry on.

Tours are defined in code, never in the catalog and never in the database. A
tour id is permanent once released, because it is the stored value of the
completion state; a tour whose steps change materially gets a new `-vN` id,
which makes every actor eligible again. `driver.js/dist/driver.css` stays an
application import: a tsc-built package cannot ship CSS and pnpm does not hoist
the dependency, so every consuming app keeps its own identical pin.

### Completion state

`UserTourState` and `ParticipantTourState` mirror the read-state tables next
door: surrogate id, `tourId` without a foreign key, cascade FK to the actor, and
one row per actor and tour. `completedAt` records the first ending and never
moves. Finishing, skipping and closing all set it, because the promise the tour
makes is "you will not be walked through this again", not "you finished it".

`tourStates(tourIds)` reads the rows for the caller — unknown ids are ignored so
that a newer frontend does not blank the answer on an older backend — and
`markTourCompleted(tourId)` writes one. The actor comes from the session, the
tour id is validated against `TOUR_IDS`, and lecturer writes obey the same scope
floor as the read-state mutations. The upsert keeps a non-empty `update` branch
so Prisma emits a native upsert; an empty one becomes a read-then-insert that
two tabs can race into a unique-constraint error.

**Two writers, one set of rules.** The chat app is Prisma-direct and will write
`ParticipantTourState` from its own API route rather than through GraphQL. The
per-surface tour ids keep the rows disjoint, but the semantics above — validated
id, non-empty-update upsert, first write wins on `completedAt` — must stay
identical in both writers. Changing them in one place only is the failure mode
to watch for. A future writer that records a started-but-unfinished tour would
create rows without a `completedAt`; it must then finish them with an update
conditioned on `completedAt` still being null, or first write wins is lost. The
current mutation deliberately has no such path — it always sets `completedAt`
when it inserts.

### When a tour starts by itself

Two conditions, and both are needed: the account has no `completedAt` for the
tour, and this browser tab has not yet shown an unsolicited overlay. The second
condition is the same `sessionStorage` slot the spotlight uses, so a lecturer
never gets a tour and a spotlight in a row.

The order between them is decided rather than raced. The tour reports when its
eligibility has settled, and the spotlight's unsolicited path waits for that
signal before it looks at the slot. On a fresh account the tour therefore wins;
once it is completed, or once it turns out to be ineligible, the spotlight
proceeds as before. Eligibility stays unknown while the state query is loading
or failed, which keeps a failed query from looking like an account that has
never seen the tour.

Auto-start is suppressed on the same routes as the spotlight, for the same
reason — driver.js blocks pointer events on the whole document — and the route
set lives in one place now
(`apps/frontend-manage/src/components/onboarding/suppressedRoutes.ts`).

A tour whose targets are all missing from the current page opens nothing and
leaves the slot alone, so a page without the header cannot silently spend the
session's single overlay.

### Replays

"Take the tour" in the support modal starts it on request. Replays ignore both
caps, and because the server never rewrites `completedAt`, replaying does not
change what the account has already recorded. The support entry renders as a
button rather than a link, since it acts on the current page.

Step copy lives under `manage.productTours` in the shared message files, in both
locales, and is escaped before it reaches a popover for the reason described in
the spotlight section.
