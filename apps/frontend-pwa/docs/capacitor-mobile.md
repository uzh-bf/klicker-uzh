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
