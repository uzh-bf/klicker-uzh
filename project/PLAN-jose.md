# JWT Migration Plan: jsonwebtoken → jose

## Current State Analysis

### Libraries in Use
- **jsonwebtoken v8.5.1/v9.0.2**: Used in 9 packages/apps
- **jose v5.9.4**: Already used in 2 places (cypress tests, hatchet-worker)

### JWT Token Types & Usage
1. **Participant Tokens**: Regular student accounts (2w expiry)
2. **Temporary Participant Tokens**: Session-based pseudonyms (2w expiry)  
3. **User Tokens**: Lecturer/admin accounts via NextAuth
4. **LTI Tokens**: Learning Tools Interoperability integration (5m expiry)
5. **Magic Link Tokens**: One-time login (15m expiry)
6. **Activation Tokens**: Email verification

All tokens use **HS256 algorithm** with `APP_SECRET` as the symmetric key.

## Migration Strategy: Phased Approach with Backward Compatibility

### Phase 1: Add jose dependency and JWT utilities to @klicker-uzh/util
1. Add jose v5.9.4 to `packages/util/package.json` 
2. Create JWT utility module `packages/util/src/jwt.ts` with:
   - `signJWT()` and `verifyJWT()` using jose
   - Backward compatibility layer for existing tokens
   - Type definitions for token payloads
3. Export from `packages/util/src/index.ts`

### Phase 2: Implement dual verification (backward compatible)
1. Update all JWT.verify() calls to use new utility that tries jose first, with an optional dynamic fallback to jsonwebtoken (Node-only)
2. Continue signing with jsonwebtoken temporarily
3. Add logging to track verification patterns

### Phase 3: Switch signing to jose
1. Update all JWT.sign() calls to use jose via util package
2. Keep dual verification active
3. Set token rotation period (e.g., 2 weeks for participant tokens)

### Phase 4: Remove jsonwebtoken (after rotation period)
1. Remove fallback verification after all old tokens expire
2. Remove jsonwebtoken dependency from all packages
3. Clean up compatibility layer

Note: jose verifies HS256 tokens created by jsonwebtoken, so the fallback can likely be skipped entirely after E2E confirmation. Keep the dynamic fallback only if tests reveal an edge case.

## Implementation Details

### File Changes Required

#### 1. packages/util/
- Add jose dependency
- Create src/jwt.ts with utilities
- Update src/index.ts to export JWT utilities

#### 2. packages/graphql/src/services/accounts.ts
- 8 JWT.sign() calls → util.signJWT()
- 3 JWT.verify() calls → util.verifyJWT()

#### 3. packages/graphql/src/scripts/
- impersonateParticipant.ts: 1 sign → util.signJWT()
- impersonateUser.ts: 1 sign → util.signJWT()

#### 4. apps/func-response-processor/src/index.ts
- 2 verify calls → util.verifyJWT()

#### 5. apps/func-incoming-responses/src/index.ts
- 2 verify calls → util.verifyJWT()

#### 6. apps/auth/src/pages/api/auth/[...nextauth].ts
- Custom encode/decode functions → util functions

#### 7. apps/lti/src/index.ts
- 1 sign call → util.signJWT()

#### 8. apps/frontend-pwa/
- getParticipantToken.ts: 2 verify, 1 sign → util functions
- createAccount.tsx: 2 verify, 1 sign → util functions

#### 9. apps/hatchet-worker-response-processor/
- Already uses jose - update to use util functions for consistency

#### 10. apps/backend-docker/
- Replace `passport-jwt` strategy (uses jsonwebtoken under the hood) with a custom middleware using util.verifyJWT() to populate `req.locals.user`. This is required before fully removing jsonwebtoken.

### JWT Utility Implementation (refined)

```typescript
// packages/util/src/jwt.ts
import * as jose from 'jose'

export interface JWTPayload {
  sub: string
  role?: string
  scope?: string
  email?: string
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
  iat?: number
  exp?: number
}

function getSecretKey(secret: string): Uint8Array {
  // Prefer Node Buffer for wide compatibility; avoids DOM TextEncoder typing
  return Buffer.from(secret, 'utf8')
}

export async function signJWT(
  payload: JWTPayload,
  secret: string,
  options: {
    algorithm?: 'HS256'
    expiresIn?: string | number
  } = {}
): Promise<string> {
  const alg = options.algorithm ?? 'HS256'
  let jwt = new jose.SignJWT(payload)
    .setProtectedHeader({ alg, typ: 'JWT' })
    .setIssuedAt()

  if (options.expiresIn) {
    jwt = jwt.setExpirationTime(options.expiresIn)
  }

  return jwt.sign(getSecretKey(secret))
}

export async function verifyJWT(
  token: string,
  secret: string,
  opts: {
    algorithms?: ('HS256')[]
    clockTolerance?: string | number
  } = {}
): Promise<JWTPayload> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecretKey(secret), {
      algorithms: opts.algorithms ?? ['HS256'],
      clockTolerance: opts.clockTolerance ?? '5s',
    })
    return payload as JWTPayload
  } catch (e) {
    // Optional dynamic fallback for legacy flows; only in Node contexts
    try {
      const { default: JWT } = await import('jsonwebtoken')
      return JWT.verify(token, secret) as JWTPayload
    } catch (_) {
      throw e
    }
  }
}

export function decodeJWT<T extends Record<string, unknown> = JWTPayload>(
  token: string
): T {
  return jose.decodeJwt(token) as T
}
```

Notes:
- jose verifies HS256 tokens generated by jsonwebtoken; fallback is a safety net and can be removed once validated by tests.
- For browser bundles, avoid importing jsonwebtoken at top-level. The dynamic import ensures it’s only pulled in on Node.
- Normalize `expiresIn` strings to concise forms (e.g., `5m`, `15m`, `60m`, `2w`).

### Async migration notes

All jose operations are async. Replace synchronous JWT usage with `await`:
- packages/graphql/src/services/accounts.ts: sign/verify at lines ~38, ~53, ~235, ~282, ~317, ~680, ~744
- apps/func-incoming-responses/src/index.ts: verify at ~line 70 and ~83
- apps/func-response-processor/src/index.ts: verify at ~137 and ~148
- apps/frontend-pwa/src/pages/createAccount.tsx: verify/sign at ~120, ~146 (server-only)
- apps/frontend-pwa/src/lib/getParticipantToken.ts: verify/sign at ~55, ~86
- packages/graphql/src/scripts/impersonate*.ts: sign at ~21
- apps/lti/src/index.ts: sign at ~58

### Replace passport-jwt

apps/backend-docker/src/app.ts currently uses `passport-jwt` (jsonwebtoken-based). Replace it with a small middleware using `verifyJWT()` from util to set `req.locals.user`. This unlocks removal of jsonwebtoken from backend-docker.

### Risk Mitigation

1. **Gradual rollout**: Deploy dual verification first
2. **Monitoring**: Log token verification method used
3. **Testing**: Extensive E2E tests with both token types
4. **Rollback plan**: Keep jsonwebtoken as dependency initially
5. **Force re-login option**: Can invalidate all tokens if needed

Additional safeguards
- **Algorithm pinning**: Restrict verification to `HS256`.
- **Clock tolerance**: Add small `clockTolerance` (e.g., 5–30s).
- **Error semantics**: Preserve expired vs invalid distinctions for observability.

## Timeline

- **Week 1**: Add JWT utilities to @klicker-uzh/util with dual verification
- **Week 2**: Update all packages to use util functions
- **Week 3**: Switch to jose for signing new tokens
- **Week 4-5**: Monitor and validate compatibility
- **Week 6+**: Remove jsonwebtoken after token rotation

Acceleration option: If E2E confirms jose verifies legacy HS256 tokens everywhere, remove the fallback sooner (Weeks 3–4) and bound NextAuth session maxAge to limit legacy token persistence.

## Next Steps

1. Add jose dependency to packages/util
2. Create JWT utility functions in packages/util/src/jwt.ts
3. Update all JWT operations to use util functions
4. Test with existing tokens
5. Switch signing to jose
6. Monitor for 2-4 weeks
7. Remove jsonwebtoken dependency

Additions
8. Replace passport-jwt in backend-docker with jose-based middleware
9. Normalize all `expiresIn` strings (`5m`, `15m`, `60m`, `2w`) and pin algorithms
10. Decide on fallback strategy (keep dynamic fallback or remove) after E2E tests

## Progress Tracking

### Phase 1: Setup ✅
- [x] Create documentation file
- [x] Add jose dependency to packages/util
- [x] Create JWT utility functions
- [x] Update util package exports

### Phase 2: Update verification (TBD)
- [ ] Update packages/graphql JWT verification
- [ ] Update function apps JWT verification
- [ ] Update auth app JWT verification
- [ ] Update LTI app JWT verification
- [ ] Update PWA app JWT verification
- [ ] Replace passport-jwt in backend-docker

### Phase 3: Switch signing (TBD)
- [ ] Switch all JWT signing to jose
- [ ] Monitor token verification patterns
- [ ] Validate backward compatibility

### Phase 4: Cleanup (TBD)
- [ ] Remove jsonwebtoken dependency
- [ ] Remove compatibility layer
- [ ] Final testing and validation

This approach ensures:
- Zero downtime
- Smooth transition with backward compatibility
- Centralized JWT handling in @klicker-uzh/util
- Option to force re-login if any issues arise
