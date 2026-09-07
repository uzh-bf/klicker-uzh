# Product Updates Subsystem — Architecture Recommendation

Date: 2026-08-27. Source: architecture evaluation provided by the product owner
(external research, pasted verbatim below). This is the decision input for
[project/2026-08-27-product-updates-roadmap.md](2026-08-27-product-updates-roadmap.md),
which turns it into junior-executable work items. Where the roadmap and this
document disagree (because codebase verification corrected a claim), the
roadmap wins.

---

## Recommendation

For KlickerUZH, build a **small native "Product Updates" subsystem**, not
Novu or a full product-adoption platform.

| Concern | Owner |
| --- | --- |
| Whether a feature is available | GrowthBook |
| What should be communicated | A typed KlickerUZH update catalog |
| Long-form release information | Existing KlickerUZH Community/Discourse |
| Per-user read and dismissal state | KlickerUZH database |
| In-app presentation | Native UZH design-system components |
| Adoption measurement | Matomo |
| Contextual feature highlighting | Driver.js, selectively |
| Email, push, digests, transactional notifications | Novu later, when the notification domain expands |

This gives the useful parts of Beamer, AnnounceKit or Noticeable without
creating another targeting system, analytics system, content silo and
external user-data integration.

## Why this fits the current KlickerUZH architecture

The lecturer application already has almost all the infrastructure required:

- GrowthBook is mounted at the application root and receives the
  authenticated user ID and role.
- The header navigation already supports badges and notification indicators.
- Apollo and GraphQL can persist read state.
- Matomo is already used for product interaction events.
- The UZH design system provides the navigation, modal, notification and
  toast primitives.

The student PWA already has Apollo, Matomo, authenticated participant
identities, dismissible UI state and push-notification infrastructure. It
does **not**, however, currently mount the GrowthBook provider, so
GrowthBook-based student targeting requires a participant-side feature-flag
provider equivalent to the lecturer provider.

There is also already a de facto public changelog: release and feature posts
in the KlickerUZH Community. The public homepage still hard-codes the v3.2
announcement, while the Community release tag currently surfaces v3.3. This
is exactly the duplication the new architecture should eliminate.

Discourse exposes category and tag feeds through RSS and a JSON API, so the
Community can remain the long-form public release archive without
introducing another CMS.

## What GrowthBook should — and should not — do

GrowthBook answers: "Is this actor currently eligible to use this feature?"
The update system answers: "How should we explain and promote this feature
to this actor?" Related but different concerns.

### Appropriate GrowthBook uses

An update entry can declare `requiredFeatureFlags: ['learning-analytics']`.
The card is eligible only when all required flags evaluate to `true`. That
ensures lecturers in the rollout cohort see the announcement, while
lecturers outside the rollout do not receive a "Try it now" CTA for
something they cannot access.

GrowthBook can also be used to:

- Coordinate an announcement with a gradual feature rollout.
- Target separate lecturer and participant cohorts using `actorType` and `role`.
- Compare "feed only" against "feed plus contextual spotlight."
- Implement a holdout group to determine whether the announcement caused
  additional feature adoption.

### Inappropriate GrowthBook uses

Do not use GrowthBook as: the changelog content database, a Markdown or
translation management system, the source of per-user read state, the
notification inbox, or the authoritative record of whether a user actually
tried a feature.

The current shared Klicker feature contract exposes Boolean flags with
false fallbacks. It is deliberately small and safe. Expanding the contract
to carry complete announcement objects would couple editorial content to
rollout configuration and make validation, localization and history more
difficult. The current sanitization layer preserves only `id`, `actorType`,
`role` and environment; arbitrary properties passed by a client are stripped.

### Flag lifecycle rule

An old changelog entry must not disappear when its feature flag is retired.
Release process: (1) ship the feature and update entry with
`requiredFeatureFlags`; (2) roll out through GrowthBook; (3) once generally
released, remove `requiredFeatureFlags` from the update entry; (4) only then
remove the obsolete GrowthBook flag.

## Content architecture

A shared package `packages/product-updates` with typed definitions,
consumed by frontend-manage, frontend-pwa, the GraphQL backend and the
documentation homepage. Representative definition:

```ts
type LocalizedText = { de: string; en: string }
type ProductUpdateAudience = 'lecturer' | 'student'
type ProductUpdateSurface = 'manage' | 'pwa' | 'docs'
type ProductUpdateMaturity = 'released' | 'preview' | 'pilot'
type ProductUpdatePromotion = 'feed' | 'new-badge' | 'spotlight'

interface ProductUpdate {
  id: string
  publishedAt: string
  expiresAt?: string
  audiences: ProductUpdateAudience[]
  surfaces: ProductUpdateSurface[]
  maturity: ProductUpdateMaturity
  requiredFeatureFlags?: FeatureFlagKey[]
  title: LocalizedText
  summary: LocalizedText
  bodyMarkdown?: LocalizedText
  image?: { src: string; alt: LocalizedText }
  cta?: { label: LocalizedText; href: string; featureKey?: string }
  detailsUrl?: string
  promotions: ProductUpdatePromotion[]
  spotlightTarget?: string // stable registry key, not a CSS selector
  suppressInAssessment: boolean
}
```

Repository-managed content is right because product updates ship with code:
normal PR review, German/English copy review, explicit maturity and
audience classification, a direct relationship to the feature flag and
implementation, no new service, a reproducible history, and CI validation
of links, flags, translations and assets. The existing `@klicker-uzh/markdown`
package can render bodies.

Long-form release information remains in the Community. An in-app update
card contains: a user-value-oriented title, two or three sentences of
benefit, one screenshot, a direct "Try it" CTA, and a "Read more" link.

### Communication maturity is explicit

- **Released:** available now to the entire indicated audience.
- **Preview:** usable by the recipient, but still evolving.
- **Pilot:** available only to an invited cohort.
- **Planned:** not part of the changelog; keep in the roadmap or Community.

GrowthBook controls actual access; the maturity label communicates quality
and support expectations.

## Persisting read state

Local storage is insufficient for authenticated lecturers and students
(no cross-device sync, unreliable unread counts, resets on reinstall, no
consistent spotlight caps). A single `lastSeenUpdateAt` is also
insufficient — GrowthBook targeting means a user may become eligible for an
older update later. Use per-update state, in separate tables for the
separate `User` and `Participant` models, with fields
`firstPresentedAt`, `readAt`, `dismissedAt`, `lastPresentedAt`,
`presentationCount`.

Small GraphQL surface:

```graphql
productUpdateStates(updateIds: [String!]!): [ProductUpdateState!]!
markProductUpdateRead(updateId: String!): ProductUpdateState!
dismissProductUpdate(updateId: String!): ProductUpdateState!
recordProductUpdatePresentation(updateId: String!): ProductUpdateState!
```

The server derives the actor from the authenticated session, never a
caller-provided ID, and validates `updateId` against the catalog. Temporary
or anonymous live-quiz participants do not receive the changelog.

## UX

**Lecturer:** bullhorn/sparkles control in the right-hand navigation before
Support; unread dot; drawer or modal feed; persistent `/updates` route;
direct CTAs; visible Preview/Pilot labels; entries marked read on card
visibility or open, not on feed open.

**Student:** visible bullhorn near the profile control (not buried in the
avatar dropdown); full-screen sheet or page on mobile; restricted to
capabilities students can directly use; never during live-quiz answering;
fully suppressed in assessment mode; plain language; direct links to
actionable destinations.

**Promotion levels:** (1) feed only — default; (2) feed plus "New" badge;
(3) one-time contextual spotlight — only for strategically important,
hard-to-discover features. At most one unsolicited spotlight per session;
dismissal suppresses future automatic presentation. Product news stays
separate from operational notifications.

## Libraries and platforms considered

- **Driver.js — recommended** for contextual highlights: small,
  dependency-free, MIT, mobile-capable. Use stable
  `data-product-feature="..."` attributes; never raw CSS selectors in
  content.
- **React Joyride** — alternative only for genuinely multi-step React
  tours. Shepherd.js and Intro.js have AGPL/commercial licensing models;
  Driver.js and Joyride avoid the interpretation burden.
- **Discourse Community — recommended** for long-form release notes; the
  catalog carries `detailsUrl` to the relevant topic. The docs homepage
  should consume the latest release entry from the catalog instead of
  hard-coding a version banner.
- **Changelog SaaS (Noticeable, Beamer, AnnounceKit, Frill)** — attractive
  only when non-developers must publish independently of deployments;
  overlaps GrowthBook/Matomo/Community/i18n; requires privacy and
  procurement review. Not now.
- **Headless CMS (Payload)** — only if frequent non-developer publishing
  emerges; prefer a small admin-panel editor backed by a Prisma model
  before an external CMS.
- **Novu** — notification infrastructure (inbox, subscribers, workflows,
  channels, digests). Justified only on commitment to a general
  notification center (sharing requests, comments, chatbot approvals,
  reminders, quotas, processing events, email/push digests). Even then the
  native catalog remains the canonical editorial source. Do not introduce
  for the changelog alone.

## Analytics

Track the funnel `eligible → presented → opened → CTA clicked → meaningful
feature use → repeat use` via Matomo events (`Product Update / Eligible`,
`Presented`, `Opened`, `Dismissed`, `CTA Clicked`, `Details Opened`) with
the update ID as label, and separately instrument the meaningful feature
events. If experiments are introduced later, wire GrowthBook exposure
events into Matomo (a tracking callback is not configured today).

## Suggested PR stack

1. Shared update catalog (package, schema, initial entries, CI validation,
   docs homepage banner from catalog).
2. Read-state backend (tables, authenticated GraphQL, catalog validation,
   unit tests).
3. Lecturer feed (header entry, unread dot, drawer/modal, `/updates`,
   flag/surface/date filtering, Matomo, CTAs).
4. Student integration (participant flag provider, student feed,
   assessment/embedded/live/anonymous exclusions, responsive presentation).
5. Contextual adoption (Driver.js, target registry, feed-triggered
   walkthroughs, spotlight caps and dismissal).
6. Release-process enforcement (user-facing PRs require an update entry or
   an explicit no-update decision; CI validates copy, audience, maturity,
   CTAs, flags, alt text).

## Final choice

**Native compact update feed + existing Community for long-form content +
GrowthBook for availability + database read state + Matomo adoption
measurement + Driver.js for rare contextual highlights.** No Novu for this
feature alone; keep it as likely future infrastructure for a broader
operational notification center.
