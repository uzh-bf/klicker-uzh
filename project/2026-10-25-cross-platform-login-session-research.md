# Native login and persistent sessions across Klicker apps

Date: 2026-10-25. Historical research snapshot `7f3dcd1ffb` on
`enhance/control-native-login`. The user has since approved implementation of
the NextAuth-centered direction, fixed 30-day native lifetime and local logout.
Current execution is tracked in [the consolidation plan](2026-10-25-control-nextauth-consolidation-plan.md)
and [ADR 0056](../docs/adr/0057-share-nextauth-policy-with-native-control.md).
Descriptions of unchanged behavior below refer to the research snapshot;
withdrawn alternatives are not implementation requirements.

## Current direction: consolidate around NextAuth

The user rejected extending the parallel native session system. **This section
supersedes both the longer opaque Redis session proposal and the refresh-token
architecture below.** Remove the persistent native session registry and improve
the existing NextAuth setup. This is an architecture discussion; application
code, accepted ADR 0055, installed apps and session policy have not changed.

The parallel layer was introduced for bundled Control on this task branch. It
is not a NextAuth Redis adapter: browser login uses NextAuth JWT cookies, while
native login exchanges browser approval for a separate opaque `kcn1_` token
whose digest and session metadata are stored in execution Redis.

### Recommended bounded scope

1. **Keep NextAuth as the sign-in owner.** Reuse edu-ID and delegated providers,
   verified login identity and shared JWT encoding, decoding and lifetime rules.
   Web keeps its protected cookies. iOS keeps the system authentication sheet
   and Keychain; a later native Android client uses the corresponding platform
   authentication surface and secure storage. The existing Android store PWA
   continues using web authentication.
2. **Retain only the necessary native handoff.** The system login browser and
   bundled WebView do not automatically share cookies. Keep the proof-bound,
   one-use browser-to-app exchange and its short-lived transaction state. The
   redirect carries a code and state, never a session credential. Temporary
   handoff records are distinct from a persistent native session registry.
3. **Make the shared session contract explicit.** The current custom unsalted
   NextAuth encoder accepts `maxAge` but does not apply it to JWT expiry. Newly
   issued tokens whose payload has no `exp` therefore receive none from that
   encoder. Fix issuance and verification deliberately, including legacy-token
   compatibility; changing cookie lifetime alone is insufficient. An explicit
   expiry must use a correct absolute timestamp or supported duration syntax,
   rather than treating a duration in seconds as a JWT timestamp.
4. **Reuse policy without exporting broad web authority.** A lecturer browser
   token can carry account-owner or administrator rights. Native Control needs
   a restricted credential produced through the shared session code, with
   server-selected purpose, scope and finite expiry. Keep current account and
   delegation checks in shared principal validation. Do not merely hand the
   browser token to Control or trust an Origin header to restrict it.
5. **Remove the persistent native machinery.** Retire native session Redis
   reads/writes, opaque token generation/digest lookup, record retention and
   record-based revoke/cancel code. Keep the platform bridge, secure storage,
   one-use handoff, transport restrictions and current permission checks.
   Simplify the duplicate broker Sign in screen as a separate visible change
   within the eventual package; preserve final account confirmation and terms.

This consolidates application policy and implementation. It does not turn
NextAuth v4 into a native OAuth authorization server. Its `getToken()` helper
can read bearer credentials, but its normal session route renews cookie
sessions. A native bearer issuance adapter remains application code; automatic
native renewal is not gained just by calling the helper.
[NextAuth v4 options](https://next-auth.js.org/configuration/options),
[NextAuth v4 callbacks](https://next-auth.js.org/configuration/callbacks).

### Isolation and lifetime

Existing API consumers verify the shared signing key without consistently
checking a token audience. Adding a native `aud` claim alone would not prevent
another consumer accepting it. Resolve this in shared session code, using a
server-selected native signing context/key derivation where it avoids changing
every legacy consumer. Keep mandatory issuer, purpose, expiry and permission
checks on the native path. This is an implementation isolation choice, not a
new identity provider or a second persistent session system. The exact central
helper boundary remains to be qualified before implementation.

Start with a finite native lifetime and no renewal endpoint. Thirty days is the
proposed convenience window, subject to the identity-freshness and logout
ruling below; it is not yet approved. A fixed 30-day token means signing in
again at the deadline, even when the app is used daily. Browser cookie renewal
continues through NextAuth. Any later native rolling renewal needs explicit
implementation and an immutable authentication time with a fixed upper bound.
Refresh rotation, reuse detection, per-device grants, a new OAuth service and a
NextAuth major upgrade are outside this proposed first package.

### Logout is the material contract decision

Removing the native session registry changes revocation. Clearing Keychain or
a NextAuth cookie ends local use; it does not invalidate a copied signed JWT.
Existing delegated-password, delegation-scope and local institutional-account
checks can still reject or reduce authority. They do not provide arbitrary
per-device logout revocation or immediate upstream edu-ID deprovisioning.

The smallest option matches ordinary JWT logout: clear the local credential
and bound remaining validity by expiry and current account checks. This is a
weaker native logout contract than ADR 0055 and requires an explicit owner
ruling before implementation. A longer token also increases the maximum
exposure of an exported bearer; secure storage does not make it a refresh token.
Cancellation after exchange likewise cannot erase an already minted JWT.

If immediate account-wide revocation is required, evaluate one shared account
session-version field as a separate extension of NextAuth policy. It would
require a migration and verification by every applicable consumer. Do not add a
native-only epoch or silently turn ordinary logout into signing out every
device. Independent per-device revocation requires corresponding server state;
that guarantee cannot be preserved while removing all such state.

### Primitive impact and acceptance

| Product primitive | Disposition | Contract and consumer impact |
| --- | --- | --- |
| Lecturer identity | Reuse | NextAuth remains the owner of edu-ID and delegated sign-in |
| App session | Extend | Shared explicit JWT expiry and restricted native projection; web cookie and native bearer transports differ |
| Current authorization | Reuse | Preserve current account, delegated-password and scope checks; restrict native authority on the server |
| Parallel native session registry | Retire | Remove persistent records and opaque credentials after qualifying the replacement |
| Session termination | Extend | Choose finite JWT local logout or an explicitly shared revocation extension; no hidden all-device logout |

Before removal, qualify token expiry and isolation, current-authority changes,
replay/cancellation and failed-exchange behavior, participant/assessment
separation, and existing web-cookie compatibility. Inventory installed pilot
binaries, update them deliberately and require one sign-in on the new contract.
Old records expiring does not make old binaries compatible with a JWT response.
Preserve accepted ADR 0055 until a reviewed replacement records these contract
changes. Physical iPad acceptance and any later Android qualification remain
separate from source checks. No runtime or infrastructure action is part of
this discussion.

## Opus 5.5 consultation on the replacement

The requested read-only consultation and one focused correction completed
successfully against the frozen source snapshot above. Opus's terminal result
was `DONE_WITH_CONCERNS`. Main checked the source, the official NextAuth v4
options and callbacks documentation, and the tagged 4.24.15 session-route
implementation. No authentication code or runtime changed.

Accepted findings:

- Remove the persistent native Redis registry. Share token helpers, issuer,
  explicit lifetime rules and current-principal validation with existing
  authentication. Native issuance still projects reduced permissions; it is
  custom adapter code, not a built-in NextAuth native session lifecycle.
- Prefer server-selected signing-key separation inside shared token code to
  prevent legacy consumers accepting a restricted native token through their
  generic web JWT path. Validate native claims and current authority after
  verifying its signature. Qualify all affected consumers before rollout.
- Keep short-lived handoff state and its replay protection, secure platform
  storage, native transport restrictions and participant/assessment separation.
  Refactor duplicated principal checks instead of maintaining two versions.
- Defer a native-only epoch, refresh rotation and a session database. Local JWT
  logout is the smallest proposed alternative, but its weaker revocation and
  cancellation semantics need the explicit ruling described above.
- Update and reauthenticate installed pilot binaries. Their bundled validator
  accepts only the old opaque format; waiting for Redis expiry is insufficient.

Main corrected two overstatements from the first memo: NextAuth's `getToken`
helper does support bearer input, and a pre-existing `exp` in a payload is not
removed by this custom encoder. The source finding concerns newly issued
payloads and ignored `maxAge`, not a claim about every deployed token. Main
also rejected a native-only epoch and automatic all-device logout as additions
to this small package.

The existing custom encoder needs its own explicit web-compatibility change
and validation. Avoid coupling a browser-session cutoff to the native registry
removal accidentally. The tagged session route confirms that normal NextAuth
renewal reads session cookies and re-encodes them; the documented bearer helper
alone does not implement native renewal.

The CLI reports Opus 5.5 and ancillary Fable 5.1 usage; this is not represented
as exclusive single-model execution. Both memos and the frozen source bundle
remain ignored under `project/_local/reviews/control-auth-session-research/`.
The optional citation checker was unavailable in the existing configuration;
primary sources were inspected directly.

## Historical research and optional later alternatives

The sections below preserve the earlier research. Their opaque-session and
refresh-grant recommendations have been withdrawn as the proposed next scope.
They describe alternatives, not dependencies of the NextAuth-centered direction.

Keep edu-ID as the owner of institutional identity. Platform authentication
surfaces remain appropriate; a native-looking login does not require collecting
institutional passwords in the app. Longer app login and browser SSO reuse are
independent decisions.

## Platform experience

| Surface | Recommended sign-in | Credential after sign-in |
| --- | --- | --- |
| iOS and iPadOS | Existing `ASWebAuthenticationSession`, using the auth broker and institutional provider | Device-scoped app session; native secure storage for a persistent credential |
| Native Android | Auth Tab with Custom Tabs fallback, using the same broker contract | Android Keystore-backed encrypted private storage for a persistent credential |
| Web, including the current Android PWA package | Normal browser login and provider redirect | `HttpOnly`, `Secure` session cookie; server-owned renewal and revocation |

RFC 8252 calls for an external user agent and PKCE for native OAuth flows.
The system authentication sheet is such a surface; an ordinary embedded
WebView is not a substitute. Prefer verified HTTPS app links for a future
callback where domain ownership and signing are configured; the existing
proof-bound custom callback is the current contract. No client secret belongs
in a native binary. [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html)

Android's Auth Tab guide recommends its focused authentication interface and
fallback to Custom Tabs. Credential Manager covers app-owned passkeys,
passwords and supported federation; it does not eliminate edu-ID's institutional
OIDC flow. The existing Android store PWA and a future Capacitor Android package
must be treated as different clients.
[Auth Tab](https://developer.chrome.com/docs/android/custom-tabs/guide-auth-tab),
[Credential Manager](https://developer.android.com/identity/credential-manager)

For iOS, stop conflating a local Face ID unlock with server login. Passkeys can
provide server authentication, but they belong to their relying-party domain.
Native app use requires the appropriate associated-domain relationship.
[Apple passkeys](https://developer.apple.com/documentation/authenticationservices/supporting-passkeys)

edu-ID already supports passkeys, including usernameless authentication. Let the
institutional login page offer them; Klicker does not need a new passkey account
system to gain this benefit. Passkeys for first-party student or delegated
accounts could be evaluated separately with account ownership and recovery.
[SWITCH passkeys](https://help.switch.ch/eduid/federation/login/auth/passkey/)

## What the current source actually does

- ADR 0055 and `apps/auth/src/lib/nativeSessions.ts` deliberately issue a
  12-hour absolute opaque session without refresh. It is stored in execution
  Redis, with a digest as its lookup key. The native credential is currently
  retrievable by JavaScript through secure storage.
- The limit is also enforced by `packages/util/src/controlNativeSession.ts`,
  `apps/backend-docker/src/controlNativeAuth.ts`, and
  `apps/frontend-control/src/lib/nativeSession.ts`. Changing only the server
  duration makes existing clients reject the issued session.
- The backend resolves native session state and checks current local principal,
  source and scope on requests. A self-contained access token is therefore not
  necessary to achieve fast validation or prompt revocation today.
- The iOS bridge forces ephemeral browser authentication. The broker first
  displays a redundant Sign in button, then the auth page offers a provider,
  and a final same-origin CSRF-checked POST confirms the account. The final
  confirmation is an explicit accepted ADR requirement.
- Hosted Manage and PWA use credentialed API requests. NextAuth v4 uses a custom
  session JWT encoder. Its unsalted path accepts `maxAge` but passes only the
  issuer into `signJWT`; the signer adds an expiration only when instructed.
  Library cookie defaults therefore do not establish the effective lifetime or
  revocation of every existing token. This needs a focused synthetic issuance
  check before a browser-session migration; no production exposure conclusion
  is made here.

NextAuth v4 documents a default 30-day session `maxAge`, with `updateAge` ignored
for JWT sessions, and permits custom encode/decode implementations. Those
customizations are why the library default alone is insufficient evidence.
[NextAuth v4 options](https://next-auth.js.org/configuration/options)

## Compare the session designs

| Design | Benefit | Cost or material limitation |
| --- | --- | --- |
| Longer opaque server session, with idle and absolute limits | Smallest extension of the current online session lookup and revocation model | A long-lived credential remains usable if exported from the WebView; persistent secure storage alone does not remove that exposure |
| Short-lived access plus rotating refresh credential | Can keep the persistent credential behind native code and limit the lifetime of a stolen UI-visible access credential | Requires atomic rotation, family revocation, concurrency control and explicit crash/lost-response behavior |
| Standard OAuth/OIDC issuer plus mature native SDK | Standard client interoperability and less custom protocol ownership | New issuer, migration and operational ownership; a client SDK cannot turn the existing custom broker into a standard issuer |

For an optional later native target, consider short-lived access plus a rotating opaque
refresh credential **if the persistent credential is contained in native code**.
Keep exchange, renewal and secure persistence behind a narrow native interface.
Do not read refresh tokens back into WebView JavaScript or expose a generic
arbitrary-URL authenticated proxy. Active malicious UI code could still invoke
allowed bridge actions; this design limits credential export, not all active
abuse. A simple longer opaque session remains a defensible smaller alternative,
provided its longer bearer exposure is an explicit accepted trade-off.

Rotation is not itself persistence. OAuth security guidance requires replay
protection for public-client refresh tokens through rotation or sender
constraint, with scope/resource binding and inactivity expiry. Preserve current
local authority checks, or explicitly account for any access-token revocation
window. Durations below are product proposals, not RFC requirements.
[RFC 9700, sections 2.2.2 and 4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14)

A future refresh design must specify one in-flight renewal, atomic successor
selection, reuse/family invalidation, and secure-storage write ordering. A lost
rotation response or process death must have a defined outcome. Start with
fail-closed reauthentication rather than inventing unrestricted grace/replay.
Any bounded idempotent recovery protocol needs separate design and testing.
Renewing authentication must never blindly replay a quiz mutation with an
unknown outcome. Also adapt Apollo so a token renewal does not rebuild the
entire client and discard its cache every few minutes.

Long-lived authority needs a deliberate storage contract. Prefer a durable
session/grant record, with Redis as a cache where useful, or prove suitable Redis
persistence and eviction behavior. Backup restoration must not revive revoked
sessions. Logout must revoke the persistent grant and any access credentials
within the chosen revocation bound. Offline local logout cannot claim confirmed
server revocation; a revoke-only recovery handle is an option to evaluate, not
an approved change to the current no-credential-queue rule.

For first-party web, keep renewal server-side with secure cookies. A backend for
frontend can keep upstream OAuth tokens off the browser when applicable; it is
not compulsory for a first-party cookie application. Do not distribute long-lived
refresh tokens through browser JavaScript or local storage merely to share a
mobile SDK. RFC 10017 is now a published August 2026 BCP, superseding the older
browser-app draft. [RFC 10017](https://www.rfc-editor.org/rfc/rfc10017.html)

## Share policy and infrastructure, not universal credentials

| Product primitive | Proposed disposition | Boundary |
| --- | --- | --- |
| Login identity and its source | Reuse | edu-ID, delegated identity, student credentials, magic/LTI and temporary identities keep their distinct authority |
| App session or device grant | Extend | Idle/absolute expiry, renewal and revocation; client, purpose, audience and scope remain explicit |
| Current authorization | Reuse | Recheck local permissions and delegation changes; choose a separate upstream claim-freshness policy |
| Session termination | Extend | Per-session and all-session revocation, with truthful offline outcomes and bounded metadata retention |

Start with Control, then reuse a proven lifecycle for suitable account-based
apps. Do not give temporary participants, assessment sessions, LTI launches or
shared classroom devices the same persistent-login policy automatically. Central
SSO can connect independent sessions without making one bearer valid everywhere.

The earlier broader proposal discussed a 10-minute access credential, 30-day
inactivity expiry and 90-day absolute expiry. The later opaque-session proposal
covered both lecturer login sources on personal devices. Both proposals are
withdrawn as the next scope; none of these durations was approved.
The absolute deadline must not move on renewal; background polling should not
silently count as deliberate user activity. Decide how long institutional
identity/affiliation claims may be stale. Local account checks do not prove that
someone is still active at their institution.

## Upstream edu-ID is a separate decision

SWITCH supports public native clients with registered redirects and PKCE.
Its refresh grant and `offline_access` must be enabled in the Resource Registry.
Published defaults are a 20-minute refresh-token timeout and a 12-hour chain
lifetime, both configurable; token reuse invalidates the chain. Do not assume
those defaults describe Klicker's actual registration.
[OIDC integration](https://help.switch.ch/eduid/service/oidc/),
[SWITCH tokens](https://help.switch.ch/eduid/service/oidc/tokens/),
[SWITCH scopes](https://help.switch.ch/eduid/service/oidc/scopes/)

Klicker can own a first-party app session independently of the IdP's access-token
lifetime. Continuous upstream refresh is needed only when the chosen identity
freshness or API requirements call for it. If used, upstream refresh credentials
stay in the server identity integration, not in every app. Its consent,
registration, expiry and revocation must be qualified separately.
[OpenID Connect offline access](https://openid.net/specs/openid-connect-core-1_0.html#OfflineAccess)

## Reduce the visible login steps

Remove the broker's extra Sign in page and choose a provider once. Keep the
existing final account confirmation until an approved replacement proves a fresh
login belongs to the current transaction. An ordinary JWT `iat` is not sufficient
proof of recent interactive authentication because encoding can refresh it.

Browser SSO reuse and persistent app login are independent. Apple documents that
ephemeral authentication avoids retaining browsing data and prevents reuse of
previous authentication; it generally recommends giving people the choice.
A proposed default is normal SSO with an explicit other-account/private path.
Opus's initial preference was to keep ephemeral sessions once app login is rare;
this is a product/privacy trade-off, not an iOS requirement.
[Apple web authentication](https://developer.apple.com/documentation/authenticationservices/authenticating-a-user-through-a-web-service)

Keep required terms visible. Any versioned server-side acceptance record needs
an explicit consent-policy design; do not infer acceptance from a provider hint,
copy a checkbox across people, or autoaccept terms.

## Privacy and migration conditions

Apply `rs-data-protection-by-design` while the shape is open: minimum
account-bound random grant identifier, client/purpose, scope, times and
revocation state; credential digests at rest; optional user-chosen label. Avoid
hardware identifiers, duplicate emails and unnecessary location/history.
Restrict session management to the account owner and authorized operators.
Explain personal/shared-device choices and the separation of app logout from
browser SSO. Set deletion and security-event retention explicitly; this proposal
is not a legal-compliance assessment.

The withdrawn opaque-session increment would have needed an ADR update, client
inventory, coordinated rollout, lifetime/logout tests and Redis recovery checks. A later refresh-based implementation would also
need a justified durable-storage decision, refresh/revoke/race/crash tests and
physical iOS/Android qualification. Preserve old-client limits. Any future web
compatibility work needs its own cookie/JWT expiry and session
revocation work, with a planned legacy cutoff rather than an incidental mass
logout. Do not assume switching NextAuth v4's delegated credentials provider to
database sessions is supported without an adapter design.

## Historical consultation and source verification

The requested Opus 5.5 consultation completed read-only against 16 frozen source
paths. Its initial recommendation favored the simpler longer opaque session. After
main challenged long-lived WebView bearer exposure, Opus revised its longer-term
recommendation to native-only rotating refresh credentials and short-lived access.
It also withdrew its bespoke rotation-recovery recipe, its blanket objection to
first-party native password forms, and its assumption that server-side terms
recording needed no policy approval. Main verified these dispositions against
the source and current documentation.

Opus returned `DONE_WITH_CONCERNS`: identity freshness, durations, consent policy
and the concrete rotation/bridge protocol remain design decisions. Main further
qualified that a native token manager is an analogy to browser token mediation,
and that device-bound keys do not by themselves solve rotation retries. Identity
freshness can be checked independently of the overall session lifetime when a
qualified revalidation mechanism exists. Without it, reauthentication must bound
stale institutional claims.

The CLI reports Opus 5.5 usage and additional Fable 5.1 usage; this is not
represented as exclusive single-model execution.

Primary Apple, Android, SWITCH, IETF and NextAuth documentation was retrieved
on the date above. Context7 supplied current NextAuth v4 options. No runtime,
credentials, account data or production configuration were needed. No source,
accepted ADR, provider configuration or session policy changed. No new tests
were added for a research document.

The optional Jev citation advisory was unavailable because its existing profile
was missing. No configuration or secret access was added. Main checked primary
source passages directly; no automated citation pass is claimed. Raw public
sources, source receipts, frozen paths and both consultation outputs remain
ignored under `project/_local/reviews/control-auth-session-research/`.

## Historical reduced-scope consultation disposition (withdrawn)

A focused Opus 5.5 challenge and correction check approved the smaller proposal
as an accurate option, conditional on the owner's lifetime decision. Its five corrections
are incorporated above: derive compatibility from actual installed clients;
order validation/client/issuance rollout; include unconfirmed-revocation
exposure; distinguish Redis loss from revocation-reviving restores; and state
delegated-login and affiliation-freshness consequences explicitly. Both known
pilot devices already have v1 builds, so they must be updated before longer
issuance. Wider distribution was not checked, and no such absence is assumed.

That reduced proposal was subsequently withdrawn after the user requested
NextAuth consolidation. It never represented approval of a 30-day policy. No application source,
runtime, accepted ADR or session setting changed while simplifying this document.
