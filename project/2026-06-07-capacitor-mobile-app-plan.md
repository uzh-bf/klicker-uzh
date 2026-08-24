# Capacitor Mobile App Plan

Problem: ship full Klicker student PWA through Android Play Store and Apple App Store with one Capacitor code path.
Target: least new code, full hosted PWA, native push, offline downloaded practice.
Plan path: `project/2026-06-07-capacitor-mobile-app-plan.md`.
Current workspace branch: `codex/next-16-upgrade`.
Implementation branch: TBD, start from `v3` before Slice 0 commit.
MR/PR: none yet.

## Goal

Do: use latest Capacitor, pinned to `8.4.0` for core/platform/push/network/app/filesystem packages.
Do: use one Capacitor app for iOS App Store and Android Play Store.
Do: keep full hosted Next.js PWA as primary app experience.
Do: keep local dev and emulation on `https://pwa.klicker.com`.
Do: use store builds with `https://pwa.klicker.uzh.ch`.
Do: add native push before first iOS submission.
Do: add offline downloaded practice before first iOS submission.
Do: reuse existing practice UI, GraphQL ops/types, grading package, i18n, design system.
Do: make Apple review story explicit: app adds native notifications and offline downloaded practice, not only website wrapper.

## Non-Goals

Skip: full Next.js static export of `apps/frontend-pwa`.
Skip: separate mobile shell or native UI rewrite.
Skip: native token auth in first version.
Skip: SQLite in first version unless Filesystem storage proves insufficient.
Skip: offline live quizzes, assessments, microlearnings, chatbot.
Skip: background quiz downloads.
Skip: monetization, IAP, payment links, upgrade CTAs in first release.
Skip: public UGC marketplace/moderation work in first release.

## Decisions

Decision: full PWA in Capacitor, remote-first.
Reason: current PWA uses SSR/dynamic routes; bundling full app would require broad Next.js rewrite.

Decision: accept Capacitor `server.url` production tradeoff.
Risk: Capacitor docs say `server.url` is live-reload/dev and not production-intended.
Mitigation: strict env profiles, production domain guard, native push, offline practice, review notes.

Decision: dev URL is `https://pwa.klicker.com`.
Decision: store URL is `https://pwa.klicker.uzh.ch`.
Check: release build fails if `.com` URL or `cleartext: true` appears in native artifacts/config.

Decision: native push mandatory before first iOS submission.
Provider: Firebase Cloud Messaging for Android and iOS.
Reason: Android needs FCM; iOS repo already initializes Firebase; one backend push path.

Decision: offline downloaded practice mandatory before first iOS submission.
Store: Capacitor Filesystem first, `Directory.Data`.
Fallback: existing browser storage path can stay web-first; IndexedDB/localForage later if needed.

Decision: downloaded practice snapshots include solutions + feedback.
Scope: published practice quizzes only.
Guard: participant authorized/enrolled; no assessment/live quiz/unpublished content.

Decision: server authoritative for XP, points, analytics.
Offline: local correctness/feedback provisional; attempts sync later.
Need: `clientAttemptId`, `quizRevision`, conflict statuses.

Decision: keep WebView cookie auth.
Reason: least new code; hosted PWA keeps existing login/session flow.
Need: verify iOS/Android WebView cookie persistence and GraphQL cookie behavior.

Decision: account deletion/privacy path required in app.
Reason: Apple account-creation rule; safer than relying on institutional exemption.

Decision: no payments/upgrade CTAs in app.
Reason: avoid Apple IAP review risk.

Decision: no public UGC in first app.
Reason: avoid Apple UGC moderation burden; instructor/course content only.

## Local Repo Evidence

Found: Capacitor scaffold already exists in `apps/frontend-pwa/ios` and `apps/frontend-pwa/android`.
Found: current Capacitor packages are `5.3.0` / push `5.0.6` in `apps/frontend-pwa/package.json`.
Found: `apps/frontend-pwa/capacitor.config.ts` uses `server.url = https://pwa.klicker.com`, `cleartext: true`, `webDir: .next`.
Found: iOS `Info.plist` allows arbitrary loads via `NSAllowsArbitraryLoads = true`.
Found: iOS entitlements use `aps-environment = development`.
Found: iOS `AppDelegate.swift` initializes Firebase and maps APNs token to Firebase Messaging token.
Found: Android `google-services.json` exists.
Found: `apps/frontend-pwa` has many `getServerSideProps` routes; full static export is not small.
Found: native push code in `_app.tsx` only logs token; no backend registration yet.
Found: browser push hook exists in shared components; backend push sending is mostly commented.
Found: practice UI is reusable: `PracticeQuiz` takes quiz object; `ElementStack` handles response mutation and localStorage.
Found: offline blocker: `ElementStack` builds responses inline and calls `RespondToElementStackDocument`; must extract adapter/serializer.
Found: existing student practice query uses `PracticeQuizDataWithoutSolutions`; full `PracticeQuizData` includes solutions.
Found: `packages/grading` exports pure grading helpers usable for local evaluation.

## Research

### Capacitor 8

Evidence: npm registry on 2026-06-07 reports `@capacitor/core = 8.4.0`; matching `cli`, `ios`, `android`, `push-notifications`, `network`, `filesystem`, `app` also `8.4.0`.
Evidence: Capacitor 8 update docs require modern native toolchain: Node 22+, Xcode 26+, iOS target 15, Android SDK 36, min SDK 24, Gradle 8.14.3.
Applicability: repo Node 24 OK; native iOS/Android project needs migration.
Source:
- https://capacitorjs.com/docs/updating/8-0
- https://ionic.io/blog/announcing-capacitor-8

### Capacitor Remote URL

Evidence: Capacitor config docs: `webDir` is compiled web asset dir; `server.url` loads external URL and is intended for live reload, not production.
Applicability: our least-code full-PWA strategy depends on `server.url`; document deliberate exception and reduce risk.
Source:
- https://capacitorjs.com/docs/config

### Next.js Static Export

Evidence: Next.js static export disables server-side features; unsupported features include server APIs, cookies, dynamic routes without static params, ISR, default image optimization, redirects/headers.
Applicability: current PWA has many `getServerSideProps` routes and dynamic auth/data flows. Full static export would be high-code rewrite.
Source:
- https://nextjs.org/docs/app/guides/static-exports

### Apple WebView Review

Evidence: Apple Guideline 4.2 requires features/content/UI beyond repackaged website.
Evidence: Apple Guideline 2.5.6 requires web browsing apps to use WebKit.
Applicability: Capacitor/WKWebView satisfies WebKit. App-review risk remains if app is just remote website.
Mitigation: ship native push + offline downloaded practice in first submission.
Source:
- https://developer.apple.com/app-store/review/guidelines/

### Apple Login, Privacy, Account Deletion

Evidence: App Review needs full app access; account-based apps need demo account or demo mode.
Evidence: privacy policy link required in metadata and app.
Evidence: apps with account creation need account deletion in app.
Evidence: Sign in with Apple exemption exists for education/enterprise auth; avoid social login changes.
Applicability: provide review demo participant, privacy/settings links, deletion/request path.
Source:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/support/offering-account-deletion-in-your-app
- https://developer.apple.com/app-store/app-privacy-details/

### Apple Push Rules

Evidence: push cannot be required for core functionality; marketing push requires explicit opt-in; payload should avoid sensitive content.
Applicability: push prompts must be user-initiated; quiz/course names in payload need privacy review; safer payload uses generic title/body + deep link IDs.
Source:
- https://developer.apple.com/app-store/review/guidelines/

### iOS PWA Capabilities

Evidence: iOS/iPadOS Home Screen web apps support Web Push since 16.4, badging, service workers, Cache API, IndexedDB.
Evidence: Safari 18.4 added Declarative Web Push; Safari 26 makes Home Screen sites open as web apps by default.
Limit: no iOS PWA App Store submission; no reliable background sync; storage can be evicted.
Applicability: web PWA remains useful, but store app needs Capacitor native push/storage for reliability.
Source:
- https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
- https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- https://webkit.org/blog/14403/updates-to-storage-policy/

### Android PWA/TWA

Evidence: Android TWA can publish PWA to Play Store with Digital Asset Links.
Evidence: TWA limits native/web mixing; native code cannot directly access WebView state.
Applicability: existing Android app can move from PWA/TWA-like route to Capacitor for same iOS/Android strategy.
Source:
- https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
- https://developer.chrome.com/docs/android/trusted-web-activity

### Capacitor Push

Evidence: Capacitor push plugin uses FCM on Android; iOS requires APNs setup and paid Apple Developer account. Firebase guide supports FCM-backed setup with APNs on iOS.
Applicability: current native repo already has Firebase iOS/Android traces; build production credential flow.
Source:
- https://capacitorjs.com/docs/apis/push-notifications
- https://capacitorjs.com/docs/guides/push-notifications-firebase

### Capacitor Storage

Evidence: Capacitor storage guide says localStorage is transient; Preferences is small key/value; SQLite is best for complex large data; Filesystem handles persistent file data.
Applicability: first offline practice can use Filesystem JSON snapshots; SQLite only if querying/sync complexity grows.
Source:
- https://capacitorjs.com/docs/guides/storage
- https://capacitorjs.com/docs/apis/filesystem

## App Store Review Story

Claim: KlickerUZH app gives students native app access to course participation, push notifications, and downloaded offline practice.
Native value:
- Native FCM/APNs push token handling.
- Downloaded practice quizzes stored on device.
- Offline practice with local feedback.
- Sync queue when network returns.
- App settings with notifications, privacy, account deletion/support.

Review notes need:
- Demo participant account.
- Demo course with at least one downloadable practice quiz.
- Steps: login, open course, download quiz, turn off network, practice offline, reconnect, sync.
- Privacy policy URL.
- Account deletion path.
- Note: app has no purchases/payment CTAs.
- Note: app contains instructor/course-scoped content, no public UGC marketplace.

## Data Model Draft

### PushDevice

Fields:
- `id`
- `participantId`
- `platform`: `ios | android | web`
- `provider`: `fcm | web-push`
- `token`
- `appId`
- `appVersion`
- `deviceId`
- `locale`
- `enabled`
- `lastSeenAt`
- `revokedAt`

Rules:
- Upsert on registration.
- Revoke on logout, permission denial, token invalid response.
- Store no sensitive payload data.

### OfflinePracticeSnapshot

Stored locally, not necessarily DB model first.

Fields:
- `schemaVersion`
- `quizId`
- `courseId`
- `quizRevision`
- `downloadedAt`
- `validUntil`
- `displayName`
- `courseDisplayName`
- `stacks`
- `elements`
- `solutions`
- `assetManifest`

Rules:
- Published practice only.
- Authorized participant only.
- Include only fields needed for rendering + local feedback.
- Do not include instructor-only/private metadata.

### OfflinePracticeAttempt

Fields:
- `clientAttemptId`
- `participantId`
- `courseId`
- `quizId`
- `quizRevision`
- `stackId`
- `responses`
- `answerTime`
- `localEvaluation`
- `createdAt`
- `syncStatus`: `pending | syncing | synced | conflict | rejected`
- `serverResult`

Rules:
- `clientAttemptId` idempotent.
- Server recomputes official result.
- Local result provisional.

## Storage Layout Draft

Filesystem root: `Directory.Data`.

Paths:
- `offline-practice/index.json`
- `offline-practice/quizzes/<quizId>/<quizRevision>.json`
- `offline-practice/attempts/<clientAttemptId>.json`
- `offline-practice/assets/<assetHash>`

Index:
- list downloaded quizzes
- current revision per quiz
- size
- pending attempt counts
- last sync

Deletion:
- per quiz delete removes snapshots/assets if unreferenced.
- logout asks whether to delete offline data; default for shared devices should delete.

## Runtime Adapter Draft

Need small app-local adapter layer, not native UI rewrite.

Interfaces:
- `getRuntimePlatform()`
- `registerPushDevice()`
- `unregisterPushDevice()`
- `downloadPracticeQuiz()`
- `listDownloadedPracticeQuizzes()`
- `loadDownloadedPracticeQuiz()`
- `saveOfflineAttempt()`
- `syncOfflineAttempts()`
- `getNetworkState()`

Implementations:
- Capacitor: PushNotifications, Filesystem, Network, App.
- Browser: existing Web Push, localforage/IndexedDB where useful, `navigator.onLine`.

## Slices

### Slice 0: Plan Commit

Do:
- Start new implementation branch from `v3`.
- Add this plan file or move it unchanged onto branch.
- Commit only plan file.

Check:
- `git status --short`.

Commit:
- `docs(project): add Capacitor mobile app plan`

### Slice 1: Capacitor 8 Migration + Build Profiles

Do:
- Upgrade `@capacitor/core`, `cli`, `ios`, `android`, `push-notifications` to `8.4.0`.
- Add `@capacitor/network`, `@capacitor/filesystem`, `@capacitor/app` pinned `8.4.0`.
- Run `pnpm install`.
- Update iOS deployment target to 15.
- Update Android min/compile/target SDK per Capacitor 8 docs.
- Update Gradle wrapper/AGP as required by Capacitor 8.
- Replace hardcoded Capacitor `server.url` with env/profile config.
- Keep dev default `https://pwa.klicker.com`.
- Add prod profile `https://pwa.klicker.uzh.ch`.
- Remove `cleartext: true` for release profile.
- Remove arbitrary iOS ATS loads for release profile.
- Add release guard script/check for `.com`, `cleartext: true`, `NSAllowsArbitraryLoads`.

Check:
- `pnpm --filter @klicker-uzh/frontend-pwa check`.
- `pnpm --filter @klicker-uzh/frontend-pwa lint`.
- `pnpm --filter @klicker-uzh/frontend-pwa build`.
- `pnpm --filter @klicker-uzh/frontend-pwa exec cap sync ios`.
- `pnpm --filter @klicker-uzh/frontend-pwa exec cap sync android`.
- Native build smoke on simulator/emulator when toolchain available.

Commit:
- `chore(frontend-pwa): upgrade Capacitor mobile runtime`

### Slice 2: Native App Hardening

Do:
- Add app navigation allowlist for Klicker domains.
- External non-Klicker links open system browser.
- Add native App plugin deep-link handler.
- Add app info/settings route links: privacy, support, account deletion.
- Configure prod APNs entitlement/profile docs.
- Add PrivacyInfo.xcprivacy if required by current SDK/plugins.
- Document local emulator `.com` setup and prod `.uzh.ch` release profile.

Check:
- iOS simulator opens dev `.com`.
- Android emulator opens dev `.com`.
- Release guard blocks dev URL when prod profile missing.
- Browser smoke with `npx agent-browser` for settings/privacy route if UI touched.

Commit:
- `fix(frontend-pwa): harden Capacitor app configuration`

### Slice 3: Push Device Backend

Do:
- Add Prisma model or adapt existing push schema for native device tokens.
- Add GraphQL mutations:
  - `registerPushDevice`
  - `revokePushDevice`
  - maybe `updateNotificationPreference`
- Add service for FCM token sends.
- Preserve existing browser Web Push path or migrate behind same dispatcher.
- Add token invalidation handling.
- Add preference model if course/event-level control needed.

Payload rules:
- title/body/deep link only.
- no sensitive answer/solution data.
- no mandatory push prompt.

Check:
- GraphQL service tests for register/revoke/upsert/idempotency.
- `pnpm --filter @klicker-uzh/graphql check`.
- Targeted backend tests if env allows; otherwise unit-test pure service shape.

Commit:
- `feat(graphql): register native push devices`

### Slice 4: Native Push Frontend

Do:
- Replace `_app.tsx` console-only token logging.
- Add runtime push adapter.
- Register token after user opt-in and participant auth exists.
- Revoke token on logout / permission denial.
- Handle notification taps -> route/deep link.
- Keep browser Web Push behavior unchanged.
- Add visible notification prefs/settings entry.

Check:
- Browser path still no Capacitor crash.
- Android emulator/device token registration if FCM setup available.
- iOS simulator limited; real device/TestFlight for APNs/FCM.
- UI prefs route verified with `npx agent-browser`.

Commit:
- `feat(frontend-pwa): add native push registration`

### Slice 5: Practice Download API

Do:
- Add GraphQL query/mutation for downloadable practice snapshot.
- Use existing `PracticeQuizData`/`ElementData` with solutions only where safe.
- Enforce published practice quiz + participant authorization.
- Add `quizRevision`, `schemaVersion`, `validUntil`.
- Add asset manifest extraction for media referenced in content/explanations.

Check:
- Access tests: authorized participant can download; unauthorized/unpublished/assessment blocked.
- Snapshot shape test for supported element types.
- `pnpm --filter @klicker-uzh/graphql check`.

Commit:
- `feat(graphql): expose practice quiz download snapshots`

### Slice 6: Offline Practice Store

Do:
- Add Capacitor Filesystem adapter.
- Add downloaded quiz index.
- Add read/write/delete/list operations.
- Add browser fallback only if needed for web route parity.
- Add storage full/error handling.
- Add logout data deletion policy.

Check:
- Unit tests for path/index helpers.
- Manual emulator test: download persists after app restart.
- Airplane mode: downloaded list still loads.

Commit:
- `feat(frontend-pwa): store downloaded practice quizzes`

### Slice 7: Practice Response Adapter

Do:
- Extract response serialization from `ElementStack`.
- Add online submit adapter wrapping `RespondToElementStackDocument`.
- Add offline submit adapter:
  - local grading using `packages/grading`.
  - local evaluation object compatible enough for current UI.
  - save attempt file.
- Keep `PracticeQuiz`, `StudentElement`, visual flow reused.
- Replace localStorage-only progress for downloaded quiz path where needed.

Check:
- Unit tests for serializer across SC/MC/KPRIM/Numerical/FreeText/Selection/CaseStudy/Flashcard/Content.
- Unit tests compare local grading to known server grading fixtures where feasible.
- Browser practice quiz still submits online.
- Offline emulator: answer downloaded quiz without network.

Commit:
- `feat(frontend-pwa): support offline practice attempts`

### Slice 8: Attempt Sync

Do:
- Add GraphQL sync mutation accepting attempt batch with idempotency keys.
- Server recomputes official evaluation and stores analytics/XP.
- Frontend sync queue:
  - network regain
  - app resume
  - manual sync button
- Add conflict states:
  - accepted
  - already synced
  - stale revision
  - no longer authorized
  - server result differs

Check:
- Backend tests for idempotency and stale revision rejection.
- Frontend unit tests for queue state transitions.
- Manual emulator: answer offline, reconnect, sync accepted.

Commit:
- `feat(frontend-pwa): sync offline practice attempts`

### Slice 9: App Store / Play Store Readiness

Do:
- Add release checklist docs:
  - Apple demo account.
  - review notes.
  - privacy policy.
  - account deletion path.
  - no payments.
  - no public UGC.
  - native/offline feature steps.
- Add screenshots/evidence capture plan.
- Verify release guard.
- Verify prod URL `.uzh.ch`.
- Verify dev URL `.com`.

Check:
- iOS real device/TestFlight: login, push opt-in, download, offline practice, sync.
- Android emulator/device: same flow.
- `pnpm run check:all` if feasible; otherwise targeted checks + reason.
- Final security review focused on token storage, push payloads, offline solution exposure, auth/authorization, deletion/logout.

Commit:
- `docs(project): record mobile app release readiness`

## Verification Matrix

Browser:
- hosted PWA loads.
- practice online unchanged.
- browser Web Push unchanged or explicitly migrated.

iOS Simulator:
- dev `.com` loads.
- navigation allowlist works.
- offline downloaded list loads after network disabled.

iOS Real Device:
- FCM/APNs token registered.
- notification tap routes correctly.
- downloaded quiz persists after app restart.
- offline practice works.
- sync works after reconnect.

Android Emulator/Device:
- FCM token registered.
- notification tap routes correctly.
- downloaded quiz persists after app restart.
- offline practice works.
- sync works after reconnect.

Release Guard:
- no `pwa.klicker.com` in prod native config/artifacts.
- no `cleartext: true`.
- no broad ATS arbitrary loads.
- prod URL is `https://pwa.klicker.uzh.ch`.

## Risks

Risk: Apple rejects as website wrapper.
Mitigation: ship native push + offline downloaded practice before first submission; include review notes/demo steps.

Risk: Capacitor `server.url` production unsupported path.
Mitigation: env-profile guard, narrow domain, native features; revisit bundled shell only if review or reliability blocks.

Risk: offline snapshot exposes solutions.
Mitigation: practice-only, published-only, authorized-only; no assessments/live quizzes; clear data deletion on logout.

Risk: client tampers with offline attempts.
Mitigation: server authoritative; local result provisional; idempotent sync; server recomputes.

Risk: WebView cookies differ by platform.
Mitigation: early device tests on login/session/GraphQL; avoid native auth until proven needed.

Risk: Firebase on iOS affects privacy docs.
Mitigation: disclose in privacy labels; keep payload minimal; review Firebase data processing.

Risk: large media makes Filesystem JSON path weak.
Mitigation: asset manifest + hashed files; add SQLite only for metadata/query needs later.

Risk: local emulator cannot resolve/trust `pwa.klicker.com`.
Mitigation: document DNS/cert/emulator setup; keep `.com` dev profile separate from prod.

## Open Questions

Question: exact FCM project split for dev/stg/prod?
Recommendation: separate Firebase apps per env; prod credentials only for release builds.

Question: push event types for first release?
Recommendation: start with course/practice reminders and new published activities; no marketing.

Question: asset scope for offline practice?
Recommendation: text/markdown/image assets first; skip video/audio unless already common in practice quizzes.

Question: deletion behavior on logout?
Recommendation: default delete local offline data on logout on shared/student-device assumption; offer keep only if security reviewed.

Question: App Store review account?
Recommendation: dedicated demo participant in demo course, no real student data.

## Progress

Current: plan approved, file created in current workspace.
Status: not committed because current branch is `codex/next-16-upgrade`, unrelated to mobile app work.
Next: start implementation branch from `v3`, move/keep this plan file, commit Slice 0 alone.
Evidence: user approved decisions Q4-Q13:
- full remote PWA, least new code.
- Capacitor same path both platforms.
- dev `.com`, prod `.uzh.ch`.
- push + offline before iOS submission.
- FCM both platforms.
- Filesystem first.
- practice-only snapshots include solutions.
- server authoritative sync.
- WebView cookie auth.
- account deletion path.
- no payments.
- no public UGC.
