# Assessment authentication recovery corrections

## Approval summary

The user approved implementing the four findings from the review of
`0f6c8719d76c78cec08545b3db205d3e620f891b`. This executable batch completes
Phase 1 in [PR #6071](https://github.com/uzh-bf/klicker-uzh/pull/6071): retain
verified participant context on provider errors, apply one transport policy,
preserve configured assessment destinations, and render participant recovery
without waiting for hydration.

The existing audience-isolated OAuth state and persistent session contracts
remain unchanged. Independent same-audience attempts and transaction storage
remain Phase 2. No migration, dependency, merge, or deployment is included.
Source delivery includes ordinary commits and pushes, PR evidence updates,
CI diagnosis and the standing-authorized final AI review. Real Edu-ID staging
proof and a coherent auth cutover remain release gates.

Latest forge feedback adds one required deployment-source correction: set
`NEXTAUTH_URL` from the existing auth origin in `cm-auth.yaml`, ensuring the
runtime receives the URL used by the new transport and cookie policy. This
does not deploy or change any live configuration. The salt-free session expiry
gap is verified as pre-existing in `origin/v3` and remains a separate follow-up;
passing numeric `maxAge` directly to the signer would incorrectly use it as an
absolute JWT expiration timestamp.

## Execution details

Continue the user's current branch `fix/assessment-auth-audience-phase1` in
`/Volumes/HOME/Git/klicker/klicker-uzh`, targeting `v3`. Preserve unrelated
untracked work. The main session owns integration, transport and page fixes,
browser proof, and delivery. A bounded executor owns provider-error handling
and its existing handler tests. The prior review and its reproductions supply
the approved design; no new product or data-model decision is required.

1. Resolve state before handling provider errors; retain participant recovery
   only when state verifies and keep unknown context neutral.
2. Resolve student destinations server-side using configured hosts and the
   same secure-cookie deployment policy used by NextAuth. Use that policy in
   the proxy, preserving HTTPS enforcement for HTTPS deployments.
3. Resolve recovery audience server-side so participant HTML never offers the
   lecturer entry point, including before hydration.
4. Verify, inspect the integrated diff, publish, and follow current-head CI and
   final review. Integrate target drift only if required for readiness.
5. Close the confirmed session-lookup race in `useStudentSession.ts` and extend
   `playwright/tests/A-login.spec.ts` with a synthetic out-of-order response
   journey. Only the latest mounted lookup may update the participant UI.
6. User-approved test restructuring: replace the script-based regression suite
   with discoverable Vitest unit and integration tests in `apps/auth/test/`,
   standard module mocks, and a small HTTP/OIDC fixture. Use one
   `apps/auth/vitest.config.ts` with unit, integration, and built-app projects.
   The built-app tests own server startup/cleanup and cover both transport
   policies. Run all three projects through the existing unit CI workflow,
   including the auth build required by the built-app project. Keep browser
   journeys in the existing Playwright suite. Migrate the existing guarded
   adapter/identity checks only if needed by this change; no database or
   production behavior changes are authorized. The executor owns script-to-test
   migration, fixtures, Vitest config and package scripts; the main session owns
   built-app tests, CI, lockfile, testing guide and verification. Acceptance is
   preserved regression coverage, passing discovered suites and exact-head CI.

### Verification portfolio

| Risk | Obligation and primary seam |
| --- | --- |
| Provider failure loses verified audience | Extend actual NextAuth handler journeys; no account handling on error |
| HTTP test deployment rejected by compiled proxy | Production-build HTTP requests; retain HTTPS-deployment rejection coverage |
| Configured assessment deep link lost | Server page props and browser sign-in request preserve synthetic path/query |
| Lecturer choice exposed before hydration | Server HTML and browser with scripts blocked; EN/DE and compact viewport |

Run the auth regression suite, typecheck, lint, build and repository formatting.
Keep built-app integration coverage in `apps/auth/test/auth-pages.built.test.ts`
for transport, configured destinations, and initial recovery HTML.
Include the existing auth handler suite in the unit CI workflow; it currently
does not run there, leaving these regressions unprotected on future changes.
Reuse prior unaffected checks. Record genuine infrastructure blockers rather
than weakening checks. Update `docs/auth-model.md` to describe server-resolved
destinations and provider-error recovery. Browser captures use synthetic data
and the existing local gallery directory; publish reviewed screenshots through
the authenticated GitHub CLI.

## Progress

- Test restructuring is implemented: 31 Vitest unit tests, 21 real-handler
  integration tests and 14 automatically managed built-app checks pass locally.
  Unit/handler coverage emits LCOV for CI. The custom Node module loader is
  removed; tests now participate in TypeScript checking. CI builds auth before
  running the built project. Coverage output is excluded from auth lint.
  Frozen dependency installation and focused formatting pass; whole-repository
  checking still fails only in the unrelated untracked chat test described below.
  The primary container startup refused a host-port conflict with the shared
  router before creating a runtime; service-free verification used the host
  toolchain. Hosted CI remains the clean-environment gate.
- Active: verification and review. All four fixes are implemented, including
  rejecting duplicated provider-error values before NextAuth logging.
- The user approved the data-hygiene hook exception for the pre-existing
  synthetic `SECRET` in `testDispatch.mts`. Gitleaks reports no leaks.
  Source publication and independent reviews can now proceed.
- Rendered the production auth ConfigMap with Helm and verified it supplies
  `NEXTAUTH_URL: https://auth.klicker.uzh.ch`. No deployment occurred.
- The confirmed stale-response race is folded into this recovery package:
  an older lookup must not restore authenticated UI after logout. A bounded
  executor owns the hook and existing login-spec regression; the main session
  owns browser verification and integration. Session expiry remains the
  pre-existing follow-up described above.
- The hook correction is verified in the browser: the old build restores the
  authenticated controls when an older response arrives after logout; the fixed
  build retains signed-out controls for both stale success and stale failure.
  Two regression cases extend the existing login spec. The test-owned response
  queue controls order without changing production code or issuing another
  lookup as a completion barrier. Auth check, lint and build plus Playwright
  typecheck and focused formatting pass.
- Verified: 52 auth regressions; auth typecheck, lint and production build;
  repository formatting; four HTTP deployment page contracts and five HTTPS
  deployment contracts. Red-before-green reproductions cover each finding.
- Browser: inspected EN desktop and DE mobile participant recovery with scripts
  blocked; no lecturer choice in initial HTML. Student restart navigates to
  `/student`. The synthetic sign-in request retains `participant=true` and the
  configured assessment path/query. No real Edu-ID request was sent.
- Whole-repository local checks are blocked by unrelated host dependencies and
  sandbox access (analytics uv cache, concurrent Prisma generation). Focused
  auth checks pass; exact-head hosted CI remains required.
- Re-running `check:all` outside the sandbox on September 20 passes 34 of 35
  Turbo check tasks. The remaining chat check fails only in the pre-existing
  untracked `apps/chat/test/proxy-correlation.test.ts`, which imports absent
  logging and LTI modules. This unrelated file is preserved and not staged.
- Hosted CI at `74619403a1`: all eight Playwright shards, unit suites, GraphQL,
  translation smoke and image builds pass. The codebase check stops before
  typechecking because deploy parity with `v3-ai` fails. The new auth ConfigMap
  entry requires coordinated source delivery to `v3-ai`; the other reported
  staging-values difference is already reconciled in current `origin/v3`.
  Do not remove the required configuration or weaken the parity gate.
- The prior slice reviewer is no longer present in native lifecycle state and
  produced no saved report. One replacement reviews the same immutable range.
- Final-review routing is not yet qualified: Claude CLI cannot refresh its
  expired OAuth session; Gemini CLI cannot obtain the required read permission
  in headless mode. Neither produced a completed review. An additional native
  advisory review is separate from that configured final-review gate.
- Terminal: all four corrections verified and published, CI/review resolved,
  with any unavailable real Edu-ID proof explicitly recorded. No deployment.
