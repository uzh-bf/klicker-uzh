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

### Verification portfolio

| Risk | Obligation and primary seam |
| --- | --- |
| Provider failure loses verified audience | Extend actual NextAuth handler journeys; no account handling on error |
| HTTP test deployment rejected by compiled proxy | Production-build HTTP requests; retain HTTPS-deployment rejection coverage |
| Configured assessment deep link lost | Server page props and browser sign-in request preserve synthetic path/query |
| Lecturer choice exposed before hydration | Server HTML and browser with scripts blocked; EN/DE and compact viewport |

Run the auth regression suite, typecheck, lint, build and repository formatting.
Add `apps/auth/scripts/testAuthPages.mts` as a small HTTP contract suite against
the built app for transport, configured destinations, and initial recovery HTML.
Include the existing auth handler suite in the unit CI workflow; it currently
does not run there, leaving these regressions unprotected on future changes.
Reuse prior unaffected checks. Record genuine infrastructure blockers rather
than weakening checks. Update `docs/auth-model.md` to describe server-resolved
destinations and provider-error recovery. Browser captures use synthetic data
and the existing local gallery directory; publish reviewed screenshots through
the authenticated GitHub CLI.

## Progress

- Active: verification and review. All four fixes are implemented, including
  rejecting duplicated provider-error values before NextAuth logging.
- The user approved the data-hygiene hook exception for the pre-existing
  synthetic `SECRET` in `testDispatch.mts`. Gitleaks reports no leaks.
  Source publication and independent reviews can now proceed.
- Rendered the production auth ConfigMap with Helm and verified it supplies
  `NEXTAUTH_URL: https://auth.klicker.uzh.ch`. No deployment occurred.
- Latest forge feedback also identifies a stale-response race in the participant
  session hook: an older lookup can restore authenticated UI after logout, but
  cannot restore the cleared cookie. It is not part of the four accepted fixes;
  disposition remains open for the final review alongside the pre-existing
  session-expiry finding described above.
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
- Existing CI at `0f6c8719d7`: Playwright shards 4 and 8 failed; final AI review
  pending. Target is six commits ahead of the common baseline, without a known
  interaction requiring another integration.
- Terminal: all four corrections verified and published, CI/review resolved,
  with any unavailable real Edu-ID proof explicitly recorded. No deployment.
