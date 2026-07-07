# PR 5130 Review: Capacitor Mobile App (UX, Quality, Production Readiness)

Reviewed on 2026-07-07 against `origin/v3` (merge base of `codex/capacitor-mobile-app`, head `d701e7fe6`). Review method: full read of the Capacitor config, release guard, plan file, and mobile docs; targeted reads of all new frontend libs/pages and the new GraphQL services; two parallel review agents (frontend UX, native shell) plus an independent backend pass; every HIGH finding re-verified by hand in the checked-out branch. External claims are grounded in the official Capacitor docs and the plugin source (citations inline).

## Verdict

The engineering inside this PR is solid: the offline sync backend is careful (per-attempt transactions, idempotency keys, revision checks, server-authoritative grading through the official `respondToElementStack` path), the plan file honestly logs what was and was not verified, and the release guard script is a real safety mechanism. The PR is safe to merge into `v3` after the small code fixes below, because none of the new backend surface is reachable until the app ships and the web PWA changes are modest.

It is, however, several concrete steps away from an App Store submission. The biggest gaps, in order of impact:

1. **Nothing ever sends a native push.** Devices register into `PushDevice`, but no send path exists anywhere (no Firebase Admin dependency; the old web-push sender in `packages/graphql/src/services/notifications.ts` is still commented out). The App Store review story leans on "native push notifications" as app value, but today a user who enables notifications will never receive one.
2. **Offline cold start is architecturally unverified.** The shell loads the hosted PWA from a remote URL (`capacitor.config.ts` `server.url`), and the downloaded-quiz page itself is server-rendered. The official Capacitor docs state that `server.url` "is not intended for use in production" ([config reference](https://capacitorjs.com/docs/config)). Whether a student in airplane mode can reach their downloaded quiz at all depends on undocumented OS WebView caching. This must be tested on a device before anything else is built on top.
3. **Downloaded quizzes have no entry point when offline.** There is no list of downloads on the home or course pages; the only link to a downloaded quiz lives on that quiz's own online page.
4. **Native shell blockers**: stale `Podfile.lock` (still pins Capacitor 5.3.0), placeholder version numbers, missing Android 13 notification permission, and committed Firebase config files.

None of this is hidden by the PR; the plan file itself says "no full iOS/Android emulator/device E2E could be run locally" and lists the toolchain blockers. This review turns those admissions plus new findings into an ordered execution plan (see "Path to production" below).

## Findings

Severity meaning: **BLOCKER** = will fail store submission or break users; **HIGH** = fix before store release; **MED** = fix before or shortly after release; **LOW** = note/follow-up.

### A. Product/UX

| #   | Sev     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | BLOCKER | Offline cold start unverified. Shell always loads `https://pwa.klicker.uzh.ch` remotely ([capacitor.config.ts:20-24](../apps/frontend-pwa/capacitor.config.ts)); the downloaded route uses `getServerSideProps` ([downloaded/[id].tsx:296](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/practiceQuizzes/downloaded/%5Bid%5D.tsx)). If the OS WebView cache does not serve the app shell offline, the entire offline feature is unreachable exactly when it is needed.          |
| A2  | HIGH    | No downloaded-quizzes list. `listDownloadedPracticeQuizzes` exists in [offlinePracticeStorage.ts](../apps/frontend-pwa/src/lib/offlinePracticeStorage.ts) but nothing on `index.tsx` or the course page renders it. A student must navigate to the quiz's online page to find the "open downloaded" link, which defeats the purpose when offline.                                                                                                                                     |
| A3  | HIGH    | Push value is registration-only. `PushDevice` rows are written but never read; no FCM/APNs dispatch path exists in the repo. Store reviewers or first users who enable notifications get silence.                                                                                                                                                                                                                                                                                     |
| A4  | HIGH    | Media assets are not downloaded. The snapshot returns an `assetManifest` (built in [practiceQuizzes.ts](../packages/graphql/src/services/practiceQuizzes.ts), `collectPracticeQuizAssetManifest`), but the frontend only stores `assetCount` ([offlinePracticeStorage.ts:294](../apps/frontend-pwa/src/lib/offlinePracticeStorage.ts)). Any quiz with images or audio shows broken media offline.                                                                                     |
| A5  | MED     | Sync failures are aggregated into one generic toast. Per-attempt statuses (`STALE_REVISION`, `NO_LONGER_AUTHORIZED`) are computed and stored but never shown individually ([practiceQuizzes/[id].tsx:380-388](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/practiceQuizzes/%5Bid%5D.tsx), [offlinePracticeSync.ts:47-64](../apps/frontend-pwa/src/lib/offlinePracticeSync.ts)). A student whose attempts were rejected cannot find out why, or which ones.                     |
| A6  | MED     | Quiz revision is `id:updatedAt` ([practiceQuizzes.ts](../packages/graphql/src/services/practiceQuizzes.ts), `getPracticeQuizDownloadSnapshot`). Any lecturer edit, however cosmetic, invalidates every student's download and rejects their pending offline attempts as stale. Expect this to happen mid-semester; the UX for it is finding A5's generic toast.                                                                                                                       |
| A7  | MED     | Download button is not gated on connectivity ([practiceQuizzes/[id].tsx:391](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/practiceQuizzes/%5Bid%5D.tsx)); tapping offline yields a generic failure toast.                                                                                                                                                                                                                                                                     |
| A8  | LOW     | No `aria-live` on async status notices (download/sync/submit), so state changes are invisible to screen readers. Labels on the new buttons are otherwise fine.                                                                                                                                                                                                                                                                                                                        |
| A9  | LOW     | Magic-link logins from email will open the system browser, not the app, because universal links are not wired (see C6). Session then lives in Safari/Chrome instead of the app. Worth a decision: either wire universal links or document username/password + in-app edu-ID as the app login paths.                                                                                                                                                                                  |

### B. Code quality (backend)

Verdicts on the three findings from the Greptile bot on the PR, then new ones.

| #   | Sev  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | MED  | CONFIRMED (Greptile 1): `registerPushDevice` upserts on `tokenHash` alone and silently reassigns `participantId` ([notifications.ts:139-167](../packages/graphql/src/services/notifications.ts)). Nuance: token takeover on re-login is correct for shared devices (an FCM token identifies a device, not a person), and exploiting it requires knowing someone's raw token. Keep the behavior but make it explicit: delete or revoke the other participant's row in the same transaction instead of mutating it in place, and add a comment stating the shared-device rationale. |
| B2  | MED  | CONFIRMED (Greptile 2): `stackAnswerTime` only checked `>= 0` in `validateOfflinePracticeAttempt` ([stacks.ts](../packages/graphql/src/services/stacks.ts)); it flows into `newAverageResponseTime` element statistics. Cap it (for example 3,600,000 ms) at validation.                                                                                                                                                                                              |
| B3  | MED  | CONFIRMED (Greptile 3): `@@unique([participantId, provider, deviceId])` on `PushDevice` does not deduplicate NULL `deviceId` rows (PostgreSQL NULLS DISTINCT). Mitigated in practice because the app always sends a stable installation id, but any client that omits it accumulates stale token rows on rotation. Use a sentinel (`''`) or make `deviceId` required in the GraphQL input.                                                                            |
| B4  | MED  | `OfflinePracticeAttemptSync` rows are never cleaned up; one row per synced attempt per participant, forever. Add a retention job (e.g. delete rows older than 90 days) before wide rollout.                                                                                                                                                                                                                                                                            |
| B5  | LOW  | Each attempt runs one interactive Prisma transaction that includes the full `respondToElementStack` pipeline (XP, leaderboards, achievements). Fine at 25 per batch, but watch transaction duration under load; the default interactive transaction timeout is 5 s.                                                                                                                                                                                                    |
| B6  | LOW  | Tests are prisma-mock unit tests (`vi.fn()` fakes in all three new test files), which is consistent with the existing suite but means no real-DB integration coverage for the unique-constraint replay path. The mock tests do cover it logically.                                                                                                                                                                                                                     |

What is good here and should not be churned: participant-only auth scopes on all four new operations (`asParticipant` in [mutation.ts](../packages/graphql/src/schema/mutation.ts) / [query.ts](../packages/graphql/src/schema/query.ts)); snapshot authorization requiring published + not deleted + non-assessment + active participation; the 25-attempt batch cap; idempotency via `@@unique([participantId, clientAttemptId])` with hash-mismatch detection on replay; sanitized replay feedback; migrations are additive-only (two new tables, no destructive change).

### C. Code quality (frontend + native shell)

| #   | Sev     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | BLOCKER | `ios/App/Podfile.lock` is stale: it still pins `Capacitor (5.3.0)` and `Firebase/Messaging (10.14.0)` while the Podfile requires Capacitor 8.4.0 ([Podfile.lock:2](../apps/frontend-pwa/ios/App/Podfile.lock)). The iOS build fails or mis-resolves until `pod install` regenerates it. The docs admit this ([capacitor-mobile.md:71](../apps/frontend-pwa/docs/capacitor-mobile.md)).                                              |
| C2  | BLOCKER | `AndroidManifest.xml` declares only `INTERNET` ([AndroidManifest.xml:40](../apps/frontend-pwa/android/app/src/main/AndroidManifest.xml)). `POST_NOTIFICATIONS` is missing, and neither the Capacitor plugin nor Firebase declares it for you (verified against the [plugin manifest](https://github.com/ionic-team/capacitor-plugins/blob/main/push-notifications/android/src/main/AndroidManifest.xml)). On Android 13+ (target SDK is 36) notifications will silently never display. |
| C3  | HIGH    | Placeholder versions everywhere: `versionCode 1` / `versionName "1.0"` ([build.gradle:10-11](../apps/frontend-pwa/android/app/build.gradle)), `CURRENT_PROJECT_VERSION = 1` / `MARKETING_VERSION = 1.0` (project.pbxproj). No bump process documented. Store uploads will collide on the second build.                                                                                                                              |
| C4  | HIGH    | `AccountDeletionForm.tsx:26-30` calls `revokeStoredNativePushRegistration` without `participantId`, unlike `Header.tsx:72-77`. On account deletion this takes the unscoped cleanup branch, which behaves differently from logout (it scans all stored tokens, including other cached participants' tokens on a shared device). Make both call sites identical.                                                                       |
| C5  | HIGH    | `practiceStackResponse.ts` is a 765-line client-side re-implementation of stack grading (local evaluation objects, `combinePracticeStackStatus` mirroring the backend's `combineStackStatus`, hardcoded `POINTS_PER_INSTANCE = 10`). Any backend scoring change silently diverges offline feedback from the server result. Acceptable for v1 since the server re-grades on sync, but this needs a named owner and a comment block in both files pointing at each other. |
| C6  | HIGH    | Deep links are half-wired. Push-tap routing works (in-app SDK listeners in `_app.tsx` with a host allowlist). But there is no `autoVerify` https intent-filter in the Android manifest (the committed `public/.well-known/assetlinks.json` is inert), no Associated Domains entitlement on iOS, and no `apple-app-site-association` file anywhere. Ordinary `https://pwa.klicker.uzh.ch/...` links from email/Safari will never open the app.                          |
| C7  | MED     | Production Firebase config is committed: `android/app/google-services.json` and `ios/App/App/GoogleService-Info.plist` reference the real `klicker-uzh` Firebase project. These are client-side identifiers, not secrets (they ship inside every APK/IPA), so this is not a leak, but the plan's own open question recommends separate Firebase apps per environment, and dev/prod config switching then needs a build-time injection story anyway. The `.gitignore` line for it is commented out. |
| C8  | MED     | `aps-environment` is `development` in `App.entitlements`. Xcode rewrites this to `production` when archiving with an App Store profile under automatic signing, but this must be verified on the first TestFlight build rather than assumed (docs line 68 already flags it).                                                                                                                                                          |
| C9  | MED     | Behavior change on the live web PWA: the bookmark toggle is now hidden for participants without a full account ([ElementStack.tsx:331](../apps/frontend-pwa/src/components/practiceQuiz/ElementStack.tsx): `withParticipant &&` was added to the condition). If intentional, note it in the PR body; if not, revert.                                                                                                                 |
| C10 | MED     | Several failure paths end in `console.warn`/`console.error` only: sync batch failures ([useOfflinePracticeSync.ts:28-60](../apps/frontend-pwa/src/lib/hooks/useOfflinePracticeSync.ts)), offline-data cleanup on logout ([offlinePracticeStorage.ts:587-591](../apps/frontend-pwa/src/lib/offlinePracticeStorage.ts)), push revoke failures ([nativePush.ts:181-193](../apps/frontend-pwa/src/lib/nativePush.ts)) where local state is cleared even if the server revoke failed. |
| C11 | LOW     | No CI touches the native projects at all (no workflow references `android/`, `ios/`, or `capacitor`; no fastlane). Every native build so far has been manual and, per the plan file, blocked by the local toolchain.                                                                                                                                                                                                                  |
| C12 | LOW     | The de.ts diff removes unrelated `wordCloud*`/`filter`/`listExamples` keys. This is rebase drift against the wordcloud PR (#4947) that landed on v3; resolve during rebase, do not ship key deletions from this branch.                                                                                                                                                                                                                |

## Usefulness assessment

Is the feature set worth shipping? Yes, with one caveat. Offline practice with server-authoritative sync is a real, defensible native capability, and it is exactly the evidence needed against an Apple Guideline 4.2 "website wrapper" rejection. The push registration groundwork is sound. The caveat: as merged, the two headline native features are each half of a feature. Push registers but never fires (A3), and offline practice works only if the student happens to be on the quiz page before losing connectivity and the WebView cache cooperates (A1, A2). The plan for the store review demo ("login, download, airplane mode, practice, reconnect, sync") exercises precisely the path that is unverified. Closing A1/A2/A3 is what converts this from a well-built scaffold into a submittable app.

## Path to production

Ordered so that the riskiest unknowns are resolved first. Each step says what to do, where, and how to know it is done. Steps 1 and 2 are prerequisites for everything else.

### Step 1: Rebase and stabilize the branch (0.5 day)

The PR is currently in `CONFLICTING` state against `v3`. Conflicts are limited to `AGENTS.md` and `pnpm-lock.yaml` (verified via `git merge-tree`).

1. `git rebase origin/v3` on `codex/capacitor-mobile-app`.
2. For `AGENTS.md`: keep both sides (the branch adds Capacitor notes, v3 added unrelated ones).
3. For `pnpm-lock.yaml`: take v3's version, then run `pnpm install` (remember `VOLTA_FEATURE_PNPM=1`) to re-add the Capacitor packages, and commit the regenerated lockfile.
4. While resolving, fix C12: make sure no `wordCloud*` i18n keys are deleted by this branch (`git diff origin/v3 -- packages/i18n/messages/de.ts` must show only additions).
5. Done when: `pnpm run check:all` passes at the repo root and the PR shows mergeable.

### Step 2: Prove or fix offline cold start (1-2 days, highest risk)

This decides whether the architecture holds. Do it before writing any more feature code.

1. Install the toolchain on a Mac: full Xcode (`xcode-select --switch /Applications/Xcode.app`), CocoaPods, JDK 21, Android Studio with SDK 36 and an emulator image (all versions per [capacitor-mobile.md](../apps/frontend-pwa/docs/capacitor-mobile.md)).
2. Run `pnpm --filter @klicker-uzh/frontend-pwa run cap:sync:ios:dev`, then `cd apps/frontend-pwa/ios/App && pod install` (this also clears C1; commit the regenerated `Podfile.lock`).
3. In the iOS Simulator against the local stack (Traefik + seeded DB, login as `testuser1`/`abcdabcd`): log in, download a practice quiz, force-quit the app, enable airplane mode in the simulator (or cut Mac network), cold-start the app.
4. Record what happens. Two outcomes:
   - The WebView serves the cached shell and the downloaded quiz opens: document exactly which navigation path works, and add that path as a required regression test to the E2E matrix in `capacitor-mobile.md`.
   - It shows a connection error: the remote-URL architecture cannot deliver the offline promise on its own. The fallback decision is then needed (bundled minimal shell via `webDir`, a Capacitor error page pointing to cached content, or a service-worker-based app shell). Escalate to Roland with the evidence before building anything; this is a plan-level decision, not a slice.
5. Repeat the same experiment on the Android emulator.
6. Done when: the observed behavior on both platforms is written into `capacitor-mobile.md` under a new "Offline cold start" heading, with a decision recorded if the fallback is needed.

### Step 3: Small code fixes from this review (1 day)

All are mechanical; each is one commit.

1. B2: add an upper bound for `stackAnswerTime` in `validateOfflinePracticeAttempt` (`> 3_600_000` returns the same `SERVER_ERROR` result as the negative check) plus a unit test in `offlinePracticeAttemptSync.test.ts`.
2. B1: in `registerPushDevice`, wrap the upsert in a transaction that first revokes/deletes any row with the same `tokenHash` belonging to a different participant, and add the shared-device comment.
3. B3: default `deviceId` to `''` at the service boundary (or make it required in `PushDeviceInput`) so the unique constraint bites; migration not needed if you normalize in the service.
4. C4: pass `participantId` in `AccountDeletionForm.tsx` exactly like `Header.tsx` does.
5. C2: add `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />` to `AndroidManifest.xml`.
6. C9: confirm with Roland whether the bookmark visibility change for temporary participants is intended; revert or document in the PR body.
7. C5: add cross-referencing comment blocks at the top of `practiceStackResponse.ts` and the grading section of `stacks.ts` ("if you change scoring here, mirror it there"), and add a checklist item to `CODEBASE_NOTES.md`.
8. Regenerate GraphQL artifacts if any schema-adjacent change was made: `pnpm --filter @klicker-uzh/graphql generate`.
9. Done when: `pnpm run check:all` and `pnpm --filter @klicker-uzh/graphql test` pass; existing Cypress practice-quiz specs pass against the branch (`pnpm run dev:test` + the practice quiz spec) to guard the shared `ElementStack`/`PracticeQuiz` refactor.

### Step 4: Downloaded-quizzes entry point (1-2 days)

Fixes A2 and most of A7.

1. Add a "Downloads" section to the participant home page (`index.tsx`) that renders `listDownloadedPracticeQuizzes(participantId)` from `offlinePracticeStorage.ts`, showing quiz name, course, pending-attempt count, and a link to `/course/[courseId]/practiceQuizzes/downloaded/[id]`. Render it only when Capacitor is native and the list is non-empty (same pattern as `NativePushSettings`).
2. Gate the download button on `Network.getStatus()` from `@capacitor/network` (disable with a tooltip when offline).
3. Surface per-attempt sync rejects: after sync, if `rejectedCount > 0`, show which quiz and reason using the stored statuses instead of the single generic toast (A5). A simple list in the existing notice component is enough.
4. Done when: agent-browser screenshots of the home page with and without downloads exist, and the downloaded route is reachable from home without visiting the online quiz page.

### Step 5: Decide and implement the push send path, or descope push from v1 (2-4 days)

A3 is a product decision with two honest options:

- **Option A (recommended): ship push end-to-end.** Add `firebase-admin` to the backend (or a Hatchet task in `packages/hatchet`), send via FCM to `PushDevice` rows (both platforms use FCM per the plan), wire it to one event type only (the existing microlearning/practice reminder path where the commented-out web-push code sits in `notifications.ts`), handle invalid-token responses by disabling the row, and keep payloads generic per the docs. Needs the Firebase service-account credential in Infisical and `turbo.json` `globalEnv`.
- **Option B: descope.** Remove the push opt-in UI from the home screen for v1 and drop "push notifications" from the store review notes; keep the registration plumbing dormant. This weakens the 4.2 story but keeps it honest (offline practice remains the native value).

Do not ship the middle state (UI invites users to enable notifications that never arrive).

### Step 6: Native release mechanics (1-2 days)

1. C3: set real versions: Android `versionCode`/`versionName`, iOS `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`, and write the bump rule into `capacitor-mobile.md` (suggest: versionCode = build number, bump every store upload).
2. C6: decide on universal links. Minimum for v1: add the `autoVerify` https intent-filter for `pwa.klicker.uzh.ch` to `AndroidManifest.xml` (the `assetlinks.json` already exists), and either add the iOS Associated Domains entitlement + host an `apple-app-site-association` on the PWA, or explicitly record "no universal links on iOS in v1" and verify magic-link login UX in the app (A9).
3. C7: move `google-services.json` / `GoogleService-Info.plist` out of git once per-environment Firebase apps exist (uncomment the `.gitignore` line, inject via CI/Infisical); until then, at least add the dev/prod split decision to the plan's open questions.
4. C8: on the first archive, confirm the built entitlements contain `aps-environment = production` (Xcode Organizer, or `codesign -d --entitlements - App.ipa`).
5. Done when: `cap:sync:ios:prod` + `cap:sync:android:prod` + `cap:check:release` all pass on a machine with the full toolchain, and an archive/AAB builds without signing errors.

### Step 7: Run the E2E matrix and submit (1 week elapsed, mostly waiting)

1. Execute the full matrix in [capacitor-mobile.md](../apps/frontend-pwa/docs/capacitor-mobile.md) (simulator, TestFlight device, Android emulator with Play services, Android device). The matrix is good; follow it as written and check off each row with date and build number in the plan file.
2. Complete the store packages exactly as listed in the plan's "Slice 11 Store Submission Package" section (demo participant, privacy policy URL, App Privacy answers, Play Data Safety, web deletion URL). None of these exist yet; they live in App Store Connect / Play Console, not the repo.
3. B4 before wide rollout: add a retention cleanup for `OfflinePracticeAttemptSync` (a Hatchet cron task deleting rows older than 90 days fits the existing worker pattern).
4. C11, can run in parallel: add a GitHub Actions job that at minimum runs `cap:sync:*:prod` + `cap:check:release` on PRs touching `apps/frontend-pwa` so config regressions are caught; full signed builds via fastlane can come later.

### Explicitly not now

- Do not rewrite the shell to a bundled/static export preemptively. That decision depends on the Step 2 evidence and on Apple's actual response; the plan already names it as the fallback.
- Do not add course-level push preferences, more push event types, or offline support for microlearnings/live quizzes before v1 ships.
- Do not chase the `webDir: '.next'` size question; nothing is copied into the binary in remote-URL mode beyond config.

## Merge recommendation

Merge after Steps 1 and 3 (rebase + code fixes + green Cypress run on the practice-quiz specs), keeping the app unlisted until Steps 2 and 5-7 complete. Rationale: the backend surface is participant-scoped and unreachable without the app; holding 9k lines unmerged for weeks of device work invites worse conflicts than `AGENTS.md` and a lockfile. The store submission itself is gated on Steps 2, 5, 6, and 7, not on the merge.

## Evidence appendix

- PR state: `gh pr view 5130` on 2026-07-07: draft, `mergeable: CONFLICTING`, checks green (CodeQL, GitGuardian only; no build/test workflow ran).
- Conflicts: `git merge-tree --write-tree origin/v3 HEAD` shows conflicts only in `AGENTS.md`, `pnpm-lock.yaml`.
- No push send path: `grep -rn "firebase\|FCM" packages/graphql/src/services` matches only the provider enum default; web-push sender commented out at `notifications.ts:198-295`.
- Capacitor production stance: capacitorjs.com config reference, `server.url`: "This is intended for use with live-reload servers. This is not intended for use in production."
- POST_NOTIFICATIONS not provided by plugin: `push-notifications/android/src/main/AndroidManifest.xml` in ionic-team/capacitor-plugins declares only the messaging service.
- Podfile.lock staleness: `grep -n "Capacitor (" apps/frontend-pwa/ios/App/Podfile.lock` returns `Capacitor (5.3.0)`.
- Versions: `android/app/build.gradle:10-11` (`versionCode 1`, `versionName "1.0"`); `project.pbxproj` (`MARKETING_VERSION = 1.0`).
- assetManifest unused: `grep -rn "assetManifest" apps/frontend-pwa/src` matches only the count in `offlinePracticeStorage.ts:294`.
- AccountDeletionForm vs Header: direct read of both call sites (lines cited in C4).
- Test style: all three new GraphQL test files use `vi.fn()` prisma mocks (14 tests total, matching the PR body).
