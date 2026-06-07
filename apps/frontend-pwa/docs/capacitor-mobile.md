# Capacitor Mobile App

Use the hosted student PWA in one Capacitor shell for Android and iOS.

## URLs

- Dev and emulator builds load `https://pwa.klicker.com`.
- Store builds load `https://pwa.klicker.uzh.ch`.
- The WebView navigation allowlist is limited to the PWA and assessment hosts for `.com` and `.uzh.ch`.
- Other external links should remain outside the WebView and open in the system browser.

## Commands

Run normal repo checks with the Volta-pinned Node 20 toolchain. Run Capacitor 8 commands with Node 22 or newer.

```bash
pnpm --filter @klicker-uzh/frontend-pwa build
pnpm --filter @klicker-uzh/frontend-pwa run cap:sync:android:dev
pnpm --filter @klicker-uzh/frontend-pwa run cap:sync:ios:dev
pnpm --filter @klicker-uzh/frontend-pwa run cap:sync:android:prod
pnpm --filter @klicker-uzh/frontend-pwa run cap:sync:ios:prod
pnpm --filter @klicker-uzh/frontend-pwa run cap:check:release
```

## Local Emulators

- Keep the existing local Traefik and `/etc/hosts` setup for `*.klicker.com`.
- Trust the local mkcert CA in the iOS simulator and Android emulator so `https://pwa.klicker.com` works.
- If an Android emulator cannot resolve the host machine route, map the Klicker domains to the host through the emulator DNS setup or use the Traefik-reachable host IP.
- Use seeded local participants for app-review-style smoke tests; do not use real student data.
- iOS Simulator can verify login, WebView routing, downloads, offline practice, and sync after reconnect. It cannot fully verify APNs delivery; use a signed real-device/TestFlight build for push.
- Android Emulator can verify FCM token registration only when Google Play services and matching Firebase configuration are available. Confirm the same flow on at least one physical device before store rollout.

## Release Readiness Checklist

- Build profile: production native artifacts must load `https://pwa.klicker.uzh.ch`; development/emulator artifacts must load `https://pwa.klicker.com`.
- Release guard: run `cap:check:release` after production `cap copy` / `cap sync` and before uploading store artifacts.
- Firebase: production `GoogleService-Info.plist` and `google-services.json` must belong to the production Firebase apps; APNs must be connected for iOS FCM.
- Push payloads: keep titles/bodies generic and route with deep-link IDs; do not include answers, grades, or sensitive course details.
- Offline data: downloaded snapshots are practice-only and include solutions for local feedback. Logout/account deletion must clear participant-scoped offline data.
- In-app links: `/docs` must expose privacy, support, and account deletion links.
- App Store Connect: set the privacy policy URL in metadata and keep App Privacy answers aligned with native SDKs, Firebase, analytics, push tokens, and course interaction data.
- Play Console: complete Data Safety and Data deletion questions, provide an in-app deletion path, and provide a web deletion URL that works outside the app.
- Store review: use a dedicated demo participant in a demo course. Never commit review credentials.
- App scope: keep purchases/payment CTAs and public UGC marketplace features out of the first student app release.

## Native E2E Matrix

Run these before release candidate sign-off:

| Flow                                        | iOS Simulator  | iOS Device/TestFlight | Android Emulator            | Android Device |
| ------------------------------------------- | -------------- | --------------------- | --------------------------- | -------------- |
| Opens dev `.com` build                      | Required       | Optional              | Required                    | Optional       |
| Opens prod `.uzh.ch` build                  | Required       | Required              | Required                    | Required       |
| Login and session persistence after restart | Required       | Required              | Required                    | Required       |
| Native push token registration              | Not sufficient | Required              | Required with Play services | Required       |
| Notification tap deep link                  | Not sufficient | Required              | Required                    | Required       |
| Download practice quiz                      | Required       | Required              | Required                    | Required       |
| Relaunch preserves download                 | Required       | Required              | Required                    | Required       |
| Airplane-mode/offline practice              | Required       | Required              | Required                    | Required       |
| Reconnect syncs offline attempt             | Required       | Required              | Required                    | Required       |
| Logout/account deletion clears offline data | Required       | Required              | Required                    | Required       |
| Privacy/support/delete-account links        | Required       | Required              | Required                    | Required       |

## iOS Release Notes

- Capacitor 8 needs a current full Xcode install, not only command-line tools.
- `App.entitlements` must use the production APNs environment in the App Store signing profile for `ch.uzh.bf.klicker.pwa`.
- The Apple Developer portal needs the Push Notifications capability enabled for the app identifier.
- `GoogleService-Info.plist` must match the Firebase iOS app used for production FCM/APNs.
- Regenerate `ios/App/Podfile.lock` with `pod install` after CocoaPods specs access works.
- Keep `PrivacyInfo.xcprivacy` in the app target and update it when native SDKs or data collection change.

## Android Release Notes

- Use JDK 21, Android SDK 36, and a current Android emulator image for Capacitor 8.
- `google-services.json` must match the Firebase Android app used for production FCM.
- Release artifacts must pass `cap:check:release`; it rejects `.com`, cleartext, and iOS arbitrary-load settings.
