# KlickerUZH Control — native shell (prototype)

Capacitor 8 iOS shell that loads the controller web app
(`apps/frontend-control`) in a WebView instead of bundling it. Native features
(push notifications, offline storage, …) are added as Capacitor plugins.

This package lives outside the pnpm workspace globs and has its own lockfile,
because the iOS build runs on the macOS host (Xcode), not in the devcontainer.

## Prerequisites (host)

- Xcode (App Store) with an iOS Simulator runtime, selected as the active
  developer directory: `sudo xcode-select -s /Applications/Xcode.app`
- The local stack running: `devrouter ensure .` from the repo root
- The simulator trusting the devrouter mkcert CA (once per simulator):

  ```bash
  xcrun simctl keychain booted add-root-cert "$(mkcert -CAROOT)/rootCA.pem"
  ```

## Run

```bash
cd native/control
pnpm install --ignore-workspace
npx cap sync ios
npx cap run ios        # or: npx cap open ios (then Run in Xcode)
```

The shell loads `https://control.klicker.localhost` by default; the auth app
(`auth.klicker.localhost`) stays inside the WebView via `allowNavigation`. To
target another deployment, set `CAP_SERVER_URL` before `cap sync`:

```bash
CAP_SERVER_URL=https://control.klicker.uzh.ch npx cap sync ios
```
