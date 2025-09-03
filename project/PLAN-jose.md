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
1. Update all JWT.verify() calls to use new utility that tries jose first, fallback to jsonwebtoken
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

### JWT Utility Implementation

```typescript
// packages/util/src/jwt.ts
import * as jose from 'jose'
import JWT from 'jsonwebtoken' // temporary for backward compatibility

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

export async function signJWT(
  payload: JWTPayload,
  secret: string,
  options: {
    algorithm?: string
    expiresIn?: string
  } = {}
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)
  const alg = (options.algorithm || 'HS256') as 'HS256'
  
  let jwt = new jose.SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
  
  if (options.expiresIn) {
    jwt = jwt.setExpirationTime(options.expiresIn)
  }
  
  return await jwt.sign(secretKey)
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload> {
  try {
    // Try jose first (new tokens)
    const secretKey = new TextEncoder().encode(secret)
    const { payload } = await jose.jwtVerify(token, secretKey)
    return payload as JWTPayload
  } catch {
    // Fallback to jsonwebtoken (old tokens)
    try {
      return JWT.verify(token, secret) as JWTPayload
    } catch {
      throw new Error('Invalid token')
    }
  }
}
```

### Risk Mitigation

1. **Gradual rollout**: Deploy dual verification first
2. **Monitoring**: Log token verification method used
3. **Testing**: Extensive E2E tests with both token types
4. **Rollback plan**: Keep jsonwebtoken as dependency initially
5. **Force re-login option**: Can invalidate all tokens if needed

## Timeline

- **Week 1**: Add JWT utilities to @klicker-uzh/util with dual verification
- **Week 2**: Update all packages to use util functions
- **Week 3**: Switch to jose for signing new tokens
- **Week 4-5**: Monitor and validate compatibility
- **Week 6+**: Remove jsonwebtoken after token rotation

## Next Steps

1. Add jose dependency to packages/util
2. Create JWT utility functions in packages/util/src/jwt.ts
3. Update all JWT operations to use util functions
4. Test with existing tokens
5. Switch signing to jose
6. Monitor for 2-4 weeks
7. Remove jsonwebtoken dependency

## Progress Tracking

### Phase 1: Setup ✅
- [x] Create documentation file
- [ ] Add jose dependency to packages/util
- [ ] Create JWT utility functions
- [ ] Update util package exports

### Phase 2: Update verification (TBD)
- [ ] Update packages/graphql JWT verification
- [ ] Update function apps JWT verification
- [ ] Update auth app JWT verification
- [ ] Update LTI app JWT verification
- [ ] Update PWA app JWT verification

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