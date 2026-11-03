# Lecturer authentication usability and browser-local policy acceptance

## Approved outcome

On 2026-10-25 the user clarified that acceptance stays local in the browser,
as before, and no database is needed. This supersedes the earlier account-wide
persistence/enforcement proposal and page-local unchecked state. No policy model,
migration, account gate or delegated-attestation decision remains in scope.

Keep the verified mobile UI correction and authoritative document dates:
privacy 2026-09-14; terms 2023-08-26. Reuse the existing sticky-state hook with a
new versioned key naming this policy pair. Old browser acceptance cannot pre-check
the box. Explicit acceptance persists in that browser and can be unchecked.
Wait for stored-state initialization before accepting input. Treat only boolean
true or the string true as acceptance; malformed values remain unchecked.

The sign-in page gates provider selection. Existing authenticated sessions retain
their current behavior and are not forced back to this page. Browser-local state
is not evidence of acceptance by every account, delegate or human. Participant
and native return contracts remain unchanged. No database work is authorized.

## Execution and verification

Reuse trees/review-control-stack-6539 on enhance/control-native-login. Baseline
UI commit bb7e4c676244700e3319b11a62f4408f4bc4d5d3. Preserve the 17 unrelated dirty
package/Xcode paths. This correction is micro: one auth-page change plus this
superseding plan update, focused checks/browser proof and one local commit.
No new source files, dependencies or automated tests.

Acceptance: old stored acceptance does not enable login; selecting the new
checkbox enables both providers and survives reload in the same browser;
unchecking survives reload. A separate browser starts unchecked. Check EN/DE
phone/iPad rendering, keyboard and link behavior using prior unchanged layout
evidence plus new stored-state captures. Run auth type/ESLint and formatter,
normal commit hooks, build and refresh only the existing private iPad auth process.
No authenticated sign-in test that writes lastLoginAt.

## Delivery and runtime

Source implementation, normal commits and supported draft delivery are authorized.
No production activation, merge/readiness, notifications, database mutations or
seventh stack layer. Existing six-layer topology still blocks a new draft layer;
retain local commits until supported publication is available.

Keep the exact existing worktree runtime and its seven routes running under the
user's manual-test lease. Use /private/tmp/control-hig-tools/devrouter source-path
exec and the existing environment-preserving private-auth restart harness. No
reset/reseed, duplicate setup, route change or native binary rebuild.

## Evidence and progress

Previous UI correction: 54 auth unit tests, type/ESLint/format, focused Opengrep,
normal hooks and production build passed. EN/DE phone/iPad default and enlarged
text, label/Space/focus and independent links passed. Opus5.5 final review passed
for bb7e4c6762. Private iPad auth process was refreshed and hydrated 44px checkbox
verified. Physical-device/VoiceOver UI checks remain user-side evidence gaps.

Browser persistence verified: old version ignored, acceptance/revocation survive
reload, locale switch retains the choice, separate browser starts unchecked.
Source/build/commit checks are recorded in
project/_local/reviews/lecturer-auth-policy/.
