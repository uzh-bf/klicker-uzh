# 28. Build product updates as a native subsystem, not a changelog service

- **Status:** Accepted — 2026-08-27
- **Deciders:** KlickerUZH maintainers

## Context

Lecturers and students learn about new KlickerUZH capabilities only through
external channels. The Community (Discourse) carries the long-form release
notes, the documentation homepage hard-codes the announcement of a release that
is already superseded, and nothing in the applications tells an authenticated
actor what changed since they last looked. Adoption of a shipped feature
therefore depends on whether someone happened to read a forum topic.

Klicker already owns every ingredient of the answer. GrowthBook decides who may
use a feature, Apollo and PostgreSQL can persist per-actor state, Matomo
measures interaction, and the UZH design system provides the presentation
primitives. What is missing is the editorial layer between them: a statement of
what should be communicated, to whom, in both German and English.

The obvious alternatives all buy that layer at the cost of a second targeting
system, a second analytics system, a content silo outside code review, and an
export of user identities to an external processor.

## Decision

Product updates are a native Klicker subsystem with four separated concerns.

**Editorial content lives in the repository.** `packages/product-updates` holds
a typed, append-only catalog of entries with localized copy, an audience, a
surface, a maturity label, and optional gates. It is a rollup-built package with
no React and no runtime dependencies, because the lecturer UI, the student PWA,
the Node GraphQL backend, and the Docusaurus documentation site must all consume
the same entries, and Docusaurus cannot transpile workspace TypeScript. Content
ships through ordinary pull-request review together with the feature it
describes, and a validation suite is its CI contract.

**Feature flags gate availability, never content.** An entry may declare
required flags; the entry is presentable only when all of them evaluate true for
that actor. Flags decide whether an actor could use the feature, so an
announcement with a "Try it" call to action never reaches someone outside the
rollout. Flags remain outside authorization entirely, per
[ADR 0008](./0008-use-growthbook-for-feature-flags.md). Because an
entry outlives its flag, the flag reference is removed from the entry before the
flag is deleted in GrowthBook, and entries without flags are always eligible.

**Read state lives in the Klicker database**, per actor and per update, in
separate tables for the `User` and `Participant` models. The server derives the
actor from the authenticated session and validates the update id against the
catalog; it never trusts a caller-supplied actor. Temporary and anonymous
participants receive no product updates.

**Long-form release information stays in the Community.** An entry carries a
`detailsUrl` to the relevant topic rather than reproducing it.

Presentation is in-app only. The push-notification path in this repository is
dead code and stays dead, and `User.sendProjectUpdates` remains a separate email
opt-in that this subsystem does not touch.

## Considered options

**A changelog service (Beamer, AnnounceKit, Noticeable, Frill).** Attractive
only when non-developers must publish independently of deployments. It
duplicates targeting, analytics, and localization that Klicker already has, and
it requires sending user identities to an external processor, with the privacy
and procurement review that implies.

**A headless CMS (Payload) or an in-app admin editor.** Justified once frequent
non-developer publishing actually emerges. Until then it adds an editing
surface, a data model, and a deployment for content that changes a handful of
times per semester.

**Novu.** Notification infrastructure — inbox, subscribers, workflows, channels,
digests. Worth revisiting when Klicker commits to a general operational
notification center covering sharing requests, comments, approvals, and
reminders. Even then the native catalog would remain the editorial source, so
introducing Novu for the changelog alone buys nothing.

**Carrying announcement objects in GrowthBook.** This would couple editorial
content to rollout configuration and lose validation, localization, and history.
The attribute sanitizer also strips everything outside a small allowlist by
construction, so the payload has nowhere to go.

**A single `lastSeenUpdateAt` timestamp, or browser local storage.** Neither
survives the targeting model: an actor can become eligible for an older entry
later, and local storage gives no cross-device state, no reliable unread count,
and no consistent presentation caps.

## Consequences

Shipping a user-facing feature now has an editorial step. Someone must decide
whether it warrants a catalog entry and write both locales; the validation suite
rejects a half-translated entry rather than shipping a placeholder.

The catalog is append-only. Entries are never deleted, because doing so would
erase the record of what was announced; an entry that should stop being shown
gets an `expiresAt`.

Localized content uses `{ de, en }` objects rather than the `nameDE`/`nameEN`
field pairs used elsewhere in the repository. The deviation is deliberate for
editorial content that is reviewed as a pair; other code does not migrate to it.

Bodies render through `@klicker-uzh/markdown`, which has GFM turned off. Tables,
strikethrough, and task lists would reach the reader as literal text, so the
validation suite rejects them.

The documentation site gains its first workspace dependency. Its build must
build the catalog package first, which also applies to the deployment pipeline
that lives outside this repository.
