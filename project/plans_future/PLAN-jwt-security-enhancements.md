# JWT Security Enhancement Plan - Breaking Changes for Modern Architecture

## Current State Analysis

After reviewing the codebase and researching current JWT best practices, I've identified significant security improvements needed:

### Current Implementation Issues:
1. **HS256 Algorithm** - Using symmetric signing where all services share the same secret
2. **Long-lived tokens** - 2 week expiry for participants with no revocation mechanism
3. **No refresh tokens** - Can't revoke compromised tokens
4. **Missing security claims** - No jti, aud, iss, nbf claims
5. **Single shared secret** - Same APP_SECRET for all token types
6. **Tokens are readable** - JWS signed but not encrypted (JWE)

## Proposed Security Enhancements

### Phase 1: Core Security Improvements (Breaking Changes)

#### 1. **Switch from HS256 to RS256 (Asymmetric Signing)**
- **Why**: In microservices, RS256 prevents services from creating forged tokens
- **Implementation**:
  - Generate RSA key pairs (4096-bit recommended)
  - Private key only on auth services
  - Public keys distributed for verification
  - Services can verify but not sign tokens

#### 2. **Implement Refresh Token Pattern**
- **Access Tokens**: 15 minutes expiry
- **Refresh Tokens**: 7-30 days expiry
- **Benefits**: 
  - Can revoke refresh tokens
  - Minimize exposure window
  - Better session management
- **Storage**:
  - Refresh tokens in secure httpOnly cookies
  - Redis for token blacklist/tracking

#### 3. **Enhanced JWT Claims**
```typescript
interface SecureJWTPayload {
  // Standard claims
  sub: string        // Subject (user ID)
  iat: number        // Issued at
  exp: number        // Expiration
  nbf: number        // Not before
  jti: string        // JWT ID (unique)
  
  // Security claims
  iss: string        // Issuer (e.g., 'klicker.uzh.ch')
  aud: string[]      // Audience (allowed services)
  
  // Custom claims
  role: string
  scope: string
  email?: string     // Consider encrypting
  sessionId: string  // Link to session
  tokenType: 'access' | 'refresh'
}
```

#### 4. **Implement JWE for Sensitive Data**
- Encrypt refresh tokens using JWE
- Keep access tokens as JWS for performance
- Encrypt any PII in tokens

### Phase 2: Infrastructure Changes

#### 1. **Token Service Architecture**
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Auth      │────▶│ Token Service│◀────│   Redis     │
│   Service   │     │   (Signing)  │     │  (Sessions) │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                     Private Key
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐   ┌──────────────┐
│   GraphQL    │    │   Backend    │   │     PWA      │
│   Service    │    │   Docker     │   │   Frontend   │
└──────────────┘    └──────────────┘   └──────────────┘
     Public Key         Public Key         Public Key
```

#### 2. **Key Rotation Strategy**
- Rotate signing keys monthly
- Support multiple public keys during rotation
- Different keys per environment (dev/staging/prod)

#### 3. **Token Revocation System**
- Redis-based revocation list
- Check JTI on critical operations
- Automatic cleanup of expired entries

### Phase 3: Advanced Security

#### 1. **Token Binding**
- Bind tokens to device fingerprint
- IP address validation (optional)
- User-agent checking

#### 2. **Rate Limiting**
- Limit refresh token usage
- Throttle failed verification attempts
- Monitor suspicious patterns

## Implementation Files Structure

```
packages/security/
├── src/
│   ├── jwt/
│   │   ├── rs256.ts          # RS256 signing/verification
│   │   ├── jwe.ts            # JWE encryption
│   │   ├── refresh-tokens.ts # Refresh token logic
│   │   └── claims.ts         # Claim validation
│   ├── keys/
│   │   ├── manager.ts        # Key rotation
│   │   └── storage.ts        # Key storage
│   └── revocation/
│       └── index.ts          # Token blacklist
├── keys/
│   ├── private/
│   └── public/
└── package.json
```

## Breaking Changes Impact

### What Will Break:
1. **All existing tokens invalid** - Need forced re-login
2. **Cookie structure changes** - Separate access/refresh tokens
3. **API changes** - New refresh endpoints needed
4. **Configuration** - RSA keys instead of simple secret

### Migration Strategy:
1. **Dual-mode support** (2-4 weeks)
   - Support both HS256 and RS256
   - Gradually migrate users
2. **Forced re-authentication**
   - Clear all sessions
   - Users must re-login
3. **Update all services**
   - Deploy new verification logic
   - Update token handling

## Security Benefits

- **Zero-trust architecture**: Services can't forge tokens
- **Minimal exposure**: 15-minute access tokens
- **Revocation capability**: Can invalidate sessions
- **Audit trail**: JWT IDs enable tracking
- **PII protection**: Encryption for sensitive data
- **Industry standard**: Following OWASP/OAuth 2.1 best practices

## Timeline Estimate

- **Phase 1**: 2-3 weeks (Core security, breaking changes)
- **Phase 2**: 1-2 weeks (Infrastructure)
- **Phase 3**: 1 week (Advanced features)
- **Migration**: 2-4 weeks (Dual support)

## Next Steps

1. **Team Review**: Present plan to security team
2. **Risk Assessment**: Evaluate migration risks
3. **POC Development**: Create proof of concept with RS256
4. **Testing Strategy**: Plan comprehensive security testing
5. **Communication Plan**: Prepare user notification strategy

## References

- [OWASP JWT Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [RFC 7519 - JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [OAuth 2.1 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-09)
- [Jose Library Documentation](https://github.com/panva/jose)

---
*Created: January 2025*  
*Status: Planning*  
*Breaking Change: Yes*