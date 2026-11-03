---
status: superseded
concepts:
  - lecturer-authentication
  - native-control
---

# Bound and revoke Control native sessions independently of browser cookies

Superseded by [ADR 0057](0057-share-nextauth-policy-with-native-control.md).
This document records the previous opaque Redis session design; it is not the
current implementation contract.

The bundled Control UI runs on a local Capacitor origin. A browser cookie is
neither its credential store nor a native logout contract. Use existing
institutional/delegated lecturer login in an external authentication browser,
then exchange a proof-bound, one-use code for an opaque, revocable **12-hour
absolute session**, without refresh. The approved iOS milestone implements this contract. Android bridge and
physical-device qualification remain subsequent acceptance work.

## Decision and trade-off

Auth owns login transactions and native session issuance. The backend resolves
the opaque credential to the existing lecturer principal and enforces existing
GraphQL permissions. Store only the credential digest and bounded session
metadata in the existing execution Redis, with an isolated `control-native:v1`
namespace. Redis loss or unavailability fails closed; it never falls back to a
browser cookie or legacy bearer interpretation for this credential prefix.

Choose this over copying the existing browser JWT into secure storage: the
current unsalted issuer does not explicitly set expiration, and cookie logout
does not revoke bearer credentials. A self-contained JWT plus a revocation
registry would retain the same state dependency with additional signing and
claim-validation ownership. A refresh-token/device-management subsystem has no
established v1 requirement. Twelve hours covers a teaching day, bounds a lost
device/offline-logout exposure, and requires explicit login the next day. Pilot
acceptance may revise that duration before issuance ships.

## Login transaction and callback

1. A native-only bridge generates independent 256-bit random `state`, verifier
   and cancellation secret. Keep one active attempt in memory. Derive the S256
   challenge as in PKCE. `POST /api/native/start` sends the challenge, state and
   cancellation-secret digest with fixed `client_id=klicker-control-v1`.
   The server returns an unguessable transaction reference and a fixed HTTPS
   authorization URL. The record expires after **five minutes**, never extended.
   Bound body sizes, validate base64url lengths, rate-limit creation and cap live
   transactions. No arbitrary redirect or API audience is accepted.
   Allow 20 starts per canonical client address per five minutes. Resolve it
   through the explicit trusted-proxy contract below; shared deployment also
   requires qualification of the actual proxy rewriting and configured ranges.
2. Open that URL through iOS `ASWebAuthenticationSession` or Android Custom
   Tabs, using a small app-local Capacitor authentication bridge. These browser
   surfaces cannot expose IdP cookies/page contents to the WebView. The broker
   is the existing auth origin at `/native/complete`; the existing NextAuth
   lecturer audience remains authoritative, with its audience-bound OAuth
   state/PKCE cookies. The new native transaction never replaces OAuth state.
   Institutional OAuth still ends at its existing HTTPS NextAuth callback.
3. Bind browser completion to the transaction using a host-only Secure,
   HttpOnly, SameSite=Lax cookie and a separate browser CSRF value. A GET may
   initiate/display login or confirmation; **only a same-origin, CSRF-checked
   POST** can approve. Show the selected lecturer account and require an
   explicit continue action. Never grant from a participant cookie, a query
   parameter naming an account, or an unbound old redirect. Restart login if
   verified lecturer evidence or delegation identity is missing.
4. Completion issues a 256-bit random code, stores only its digest, and binds
   it to transaction, challenge, state, client, exact callback, verified subject,
   effective scope and login source. It expires after **60 seconds**, also
   bounded by the original transaction deadline. The fixed callback is
   `ch.uzh.klicker.control:/auth/callback`; register this exact reverse-domain
   scheme in each platform. The app checks scheme, empty authority, exact path,
   one code/state value, no fragment and the live local state before exchange.
   This scheme is interceptable by another app; proof binding prevents an
   interceptor redeeming the code. It does not attest the installed binary.
   Claiming an HTTPS callback later requires separate domain/signing setup.
5. `POST /api/native/exchange` sends code, verifier, transaction reference,
   state and fixed client ID as JSON with cookies omitted. Validate all bindings
   and expiry, then atomically consume the code/transaction and create one
   session in a Redis transaction/Lua operation. Two concurrent exchanges yield
   one success. Incorrect proof does not consume a valid code. Used/expired
   codes give a generic failure. No credential is returned in redirects, GET
   responses, browser completion pages, or error details. Successful exchange
   returns `{access_token, token_type: 'Bearer', expires_at}` under `no-store`.
   A lost exchange response requires a fresh login; it cannot replay issuance.

Cancellation closes the browser and marks the local attempt cancelled immediately.
`POST /api/native/cancel` proves the cancellation secret. Cancel and exchange
serialize atomically: cancellation first prevents issuance; exchange first leaves
a bounded tombstone mapping the transaction to the new session digest, allowing
cancel to delete that session. Keep the tombstone only until the original
five-minute transaction deadline. Cancellation during exchange also aborts the
client request; a late success response is never persisted or used, and triggers
best-effort revocation using its returned bearer. Clear local attempt material
when cleanup completes. If cancel/revoke cannot be confirmed, show the same
bounded unconfirmed-revocation state as offline logout; expiry remains the upper
bound. A late callback is ignored even if the cancel request failed. Expiry removes abandoned records automatically. Native
process death abandons the attempt and starts a new one; no background exchange
or stored verifier is needed. The callback URL contains only the short-lived
code and correlation state, never an access, refresh or browser session token.

## Native start address trust

`CONTROL_NATIVE_TRUSTED_PROXY_CIDRS` is an explicit comma-separated CIDR list;
chart value `auth.nativeTrustedProxyCidrs` defaults to empty. Empty uses only
the connection peer and ignores forwarding headers. Validate configuration
before accepting a start, with at most 8 KiB and 64 nonempty ranges. Accept
strict IPv4/IPv6 literals and nonzero decimal family-appropriate prefix lengths; reject
ports, brackets, zone identifiers, shorthand IPv4 and leading-zero octets.
Normalize IPv4-mapped IPv6 to IPv4, including mapped CIDRs with prefixes above 96. Reject zero-bit ranges after normalization. Strict Node address validation precedes pinned `ipaddr.js` CIDR operations.

Only a trusted socket peer may supply `X-Forwarded-For`. Require exactly one
raw header occurrence, at most 4 KiB and 32 nonempty entries. Walk from right to
left across configured trusted hops; the first untrusted address is the client.
Ignore claims farther left. Reject a chain containing only trusted addresses,
missing forwarding data, duplicate headers or malformed traversed addresses.
Invalid server configuration/socket data returns generic 503; unusable trusted
forwarding returns generic 400. Resolve this only for native start, preserving
exchange/cancel/revoke during proxy-configuration failures. HMAC the canonical
address before writing the existing expiring quota counter; raw IP addresses
are never stored or logged. Clients sharing NAT still share an address quota.

Operators qualify the actual controller and proxy rewriting before shared use.
Trust no default private ranges or inferred hop count. Source/chart checks prove
neither the deployed trust chain nor ingress/collector redaction.

## Session, scope and revocation

The opaque bearer format is `kcn1_` plus 256 bits of cryptographic randomness.
The record keyed by SHA-256 of the complete credential contains version,
`issuer=auth`, `audience=control-graphql`, `purpose=lecturer-control`, subject,
issued/expiry times, scope ceiling and login-source reference. No email, device
fingerprint, IdP token or course/session ID belongs in it. Enforce both Redis
TTL and the stored absolute deadline; a credential cannot renew itself.

Only existing `USER`/`ADMIN` lecturer accounts qualify. Resolve the current
account on completion/exchange and each authenticated API request. Participant,
temporary participant, `OTP`, `ACTIVATION`, `EDUID`, missing/unknown scope and
missing subject are denied. Native scope is the lower of the verified login
scope and `SESSION_EXEC`; read-only remains read-only. Native role is `USER`,
even for an administrator. Backend field/object permission checks still apply.

Delegated login needs its exact `UserLogin.id` and a server-keyed digest of the
password hash captured **when the credentials are verified**, in new
server-verified lecturer JWT evidence. Add that provenance in the existing
credentials/JWT callbacks;
older delegated cookies without it must sign in again for native handoff.
Each native request rechecks the row belongs to the account and computes the
lower of the issued ceiling and its current scope. Row deletion or password
change revokes its native sessions. Compare the authentication-time keyed digest
with the current row at completion and exchange, before copying it into the
native record; compare again on every native request. A pre-change browser
cookie cannot mint a new session after a password change.
Never expose or log the password hash/digest. Account-owner sessions bind to the
verified lecturer `Account.id`; deleting/unverifying that identity revokes them.
Current account entitlements are loaded server-side, rather than copied from
stale tokens. There is no scope or privilege escalation through local routing.

`POST /api/native/revoke` authenticates the opaque credential and deletes its
exact record; repeated revocation is idempotent and returns no identity. On
normal online logout, revoke before reporting server sign-out, then clear local
credentials and Apollo/user caches. A failure always permits local sign-out but
must say server revocation is unconfirmed; the server record can survive only
until its original expiry. No hidden retry queue keeps credentials after local
sign-out. Browser/IdP SSO is a separate session: native logout neither claims to
log out every browser nor relies on cookie clearing for revocation. Account
switch first signs out the current native session, clears caches, then offers
browser account selection; it cannot silently restore the previous account.

## Storage, transport and privacy defaults

Use `@aparajita/capacitor-secure-storage` **8.0.1**, MIT, in the native bundle only.
Its published Capacitor-8 implementation uses iOS Keychain and Android
KeyStore-backed AES-GCM over private preferences. Set a dedicated nonempty key
prefix, disable iCloud synchronization explicitly, and use
`whenUnlockedThisDeviceOnly` on iOS. Disable Android backup for credential
preferences. Never use its unencrypted Web/localStorage fallback. An ordinary
app-container installation marker causes stale iOS Keychain credentials to be
cleared after reinstall; server expiry is still authoritative. Secure-storage
failure leaves the app signed out and clears caches. If issuance already
succeeded, best-effort revoke the in-memory bearer before clearing it; report
unconfirmed server revocation when that request fails. Never report successful
server sign-out or retain a hidden credential queue after failed persistence. Only the bearer and expiry persist; Apollo
and user data stay in memory and are cleared on logout/account switch. Reading
secure storage into JS for a request means bundled-code integrity remains part
of the trust boundary; storage encryption does not protect against active XSS.

Use WebView `fetch`/Apollo over HTTPS with `Authorization: Bearer`,
`credentials: 'omit'` and the existing Yoga CSRF header. No cookie copying,
global native HTTP interception or new WebSocket authentication is required;
current Control queries/mutations poll. Handle expiry with sign-in and preserve
only an unprivileged return route; do not silently replay a pending mutation.

Classify native CORS by **exact local Origin plus endpoint**, before the generic
reflector: OPTIONS contains no bearer and cannot use its prefix. For main
GraphQL and `/api/native/{start,exchange,cancel,revoke}`, answer allowed native
preflight with only the required methods/headers, an exact echoed Origin,
`Vary: Origin`, and no Allow-Credentials. End preflight there; native actual
responses bypass the reflector so it cannot overwrite headers. Reject other
origins on native auth endpoints; same-origin browser completion has a separate
CSRF policy. Actual GraphQL native credentials also require an allowed local
Origin and main endpoint; origin alone never authenticates a request.

The backend handles the `kcn1_` prefix before legacy cookie/bearer selection,
checks the record's exact version/issuer/audience/purpose and current principal,
and accepts it only on the main GraphQL endpoint, never assessment endpoints.
Invalid native credentials cannot fall back. Preserve existing assessment and
web paths. Native auth endpoints accept only the fixed configured local origins
(`capacitor://localhost` on iOS, `https://localhost` on Android), with narrow
preflight methods/headers and no credentialed CORS. Browser completion accepts
only the same auth origin and its CSRF proof. Reject null/wildcard origins.
The existing backend currently reflects origins with credentials; B1 must
apply the native-specific policy before that handler rather than claim an
allowlist already exists. Origin checks are defense in depth, not app identity.
Release builds fix production HTTPS API/auth origins and contain no dev fallback.
The native local origins are documented defaults until observed on a device.

Auth outcome logs use server-generated correlation IDs, route templates and
bounded action/provider/audience/outcome/error categories. Runtime field
allowlisting omits arbitrary metadata, error messages/stacks/causes, request
headers/body/path and account/affiliation identifiers. Cover NextAuth library
error/warn/debug channels and direct helper errors, including participant and
invitation handling and notification transport failures. Keep useful bounded outcomes. Suppress auth framework
incoming request logs in development; this does not configure gateway logs.

Keep native analytics off. Remove raw navigation URL logging, including DEBUG
builds; use only bounded outcome categories and destination hosts. Redact auth
paths/query strings and bearer bodies/headers at application and ingress logs.
Use `no-store` and no third-party resources on broker pages. Native credential
API responses use `Referrer-Policy: no-referrer`. The browser broker explicitly
uses `Referrer-Policy: same-origin` in both its response and meta tag: navigation
forms with `no-referrer` suppress the Origin required by its confirmation POST.
This supersedes the earlier all-endpoint `no-referrer` policy for the broker
only. Cross-origin referrers remain suppressed; same-origin auth requests may
carry its five-minute transaction reference, which is neither the proof nor a
credential. Keep that reference out of request/referrer logs. The broker CSP
allows form actions to its own origin and the fixed app callback scheme, so the
approved POST can redirect into the authentication session. Transaction material exists only for 5 minutes, code material
for 60 seconds, session metadata for 12 hours or earlier revocation. Redis
expiration bounds active records; existing platform backup/log policy must be
checked before B1 acceptance, since TTL alone does not prove backup deletion.
These are security lifetimes for the existing authentication purpose; no new
legal basis, telemetry purpose or legal retention period is inferred. Update
the native privacy disclosure before any real pilot. This contract review proves
none of the implementation, IdP, storage, device or deletion behavior.

## Evidence and qualification

This draft follows the existing NextAuth audience dispatch, JWT issuer,
GraphQL scope checks and cookie-only logout. The trade-offs follow
[RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html) and the storage
[implementation and MIT license](https://github.com/aparajita/capacitor-secure-storage).
Its exact future paths and behavior tests belong to the linked
[mobile implementation plan](../../project/2026-10-23-control-mobile-release-plan.md).
B1 requires physical-device institutional success/cancel/replay/expiry/logout
and delegated-scope checks before authentication is qualified.
