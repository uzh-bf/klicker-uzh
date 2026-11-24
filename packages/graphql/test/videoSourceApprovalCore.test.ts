import { describe, expect, it } from 'vitest'
import {
  APPROVAL_GRANT_WINDOW_DAYS,
  auditEventHash,
  canonicalJson,
  consentTextSha256,
  escapeHtml,
  evaluateApprovalLink,
  findAuditChainBreak,
  grantExpiryFor,
  hashApprovalToken,
  identityMatchesRecipient,
  isVideoSourceApprovedAt,
  isWellFormedApprovalToken,
  mintApprovalToken,
  snapshotSha256,
} from '../src/services/videoSourceApprovalCore.js'

describe('approval tokens', () => {
  it('mints 256-bit url-safe tokens and stores only their hash', () => {
    const { token, tokenSha256 } = mintApprovalToken()
    expect(token).toHaveLength(43)
    expect(isWellFormedApprovalToken(token)).toBe(true)
    expect(tokenSha256).toBe(hashApprovalToken(token))
    expect(tokenSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenSha256).not.toContain(token)
    expect(mintApprovalToken().token).not.toBe(token)
  })

  it('rejects anything that cannot be a minted token', () => {
    for (const value of [
      '',
      'short',
      `${'a'.repeat(42)}=`,
      `${'a'.repeat(44)}`,
      null,
      undefined,
      42,
    ]) {
      expect(isWellFormedApprovalToken(value)).toBe(false)
    }
  })
})

describe('evaluateApprovalLink', () => {
  const sentAt = new Date('2026-11-23T10:00:00Z')
  const grantExpiresAt = grantExpiryFor(sentAt)
  const validUntil = new Date('2027-02-01T00:00:00Z')

  it('grants for 14 days after sending', () => {
    expect(APPROVAL_GRANT_WINDOW_DAYS).toBe(14)
    expect(grantExpiresAt.toISOString()).toBe('2026-12-07T10:00:00.000Z')
    const request = {
      status: 'OPEN' as const,
      grantExpiresAt,
      validUntil: null,
    }
    expect(
      evaluateApprovalLink(request, new Date('2026-12-07T09:59:59Z'))
    ).toEqual({ state: 'AWAITING_APPROVAL', canApprove: true, canRevoke: true })
    expect(evaluateApprovalLink(request, grantExpiresAt)).toEqual({
      state: 'GRANT_EXPIRED',
      canApprove: false,
      canRevoke: true,
    })
  })

  it('revokes an approval long after the grant window and the semester', () => {
    const active = { status: 'ACTIVE' as const, grantExpiresAt, validUntil }
    expect(
      evaluateApprovalLink(active, new Date('2026-12-20T00:00:00Z'))
    ).toEqual({ state: 'ACTIVE', canApprove: false, canRevoke: true })
    expect(
      evaluateApprovalLink(active, new Date('2028-06-01T00:00:00Z'))
    ).toEqual({ state: 'ENDED', canApprove: false, canRevoke: true })
    expect(
      evaluateApprovalLink(
        { status: 'APPROVED', grantExpiresAt, validUntil: null },
        new Date('2027-01-01T00:00:00Z')
      )
    ).toEqual({ state: 'AWAITING_ADMIN', canApprove: false, canRevoke: true })
  })

  it('does nothing once revoked or superseded', () => {
    for (const status of ['REVOKED', 'SUPERSEDED'] as const) {
      expect(
        evaluateApprovalLink(
          { status, grantExpiresAt, validUntil: null },
          sentAt
        )
      ).toMatchObject({ canApprove: false, canRevoke: false, state: status })
    }
  })
})

describe('isVideoSourceApprovedAt', () => {
  it('lets the gateway act only on an approved, unexpired source', () => {
    const now = new Date('2026-12-01T00:00:00Z')
    const approved = {
      status: 'APPROVED',
      activeRequestId: 'r1',
      validUntil: new Date('2027-02-01T00:00:00Z'),
    }
    expect(isVideoSourceApprovedAt(approved, now)).toBe(true)
    expect(
      isVideoSourceApprovedAt(approved, new Date('2027-02-01T00:00:00Z'))
    ).toBe(false)
    expect(
      isVideoSourceApprovedAt({ ...approved, status: 'REVOKED' }, now)
    ).toBe(false)
    expect(
      isVideoSourceApprovedAt({ ...approved, activeRequestId: null }, now)
    ).toBe(false)
  })
})

describe('identityMatchesRecipient', () => {
  it('compares emails case-insensitively and flags private edu-ID mail', () => {
    expect(
      identityMatchesRecipient('Head@Example.org', [' head@example.org '])
    ).toBe(true)
    expect(
      identityMatchesRecipient('head@example.org', ['alex@private.example'])
    ).toBe(false)
    expect(identityMatchesRecipient('head@example.org', [null])).toBe(false)
  })
})

describe('audit hash chain', () => {
  function row(
    seq: number,
    prevHash: string | null,
    payload: Record<string, unknown>
  ) {
    const content = {
      type: 'APPROVAL_REQUESTED',
      sourceId: 's1',
      requestId: 'r1',
      actorUserId: 'u1',
      actorEmail: 'admin@example.org',
      payload,
      createdAt: new Date(`2026-11-23T10:00:0${seq}.000Z`),
    }
    return {
      ...content,
      seq,
      prevHash,
      hash: auditEventHash(prevHash, content),
    }
  }

  it('detects edited and removed rows', () => {
    const first = row(1, null, { a: 1 })
    const second = row(2, first.hash, { b: 2 })
    const third = row(3, second.hash, { c: 3 })
    expect(findAuditChainBreak([first, second, third])).toBeNull()
    expect(findAuditChainBreak([first, third])).toBe(3)
    expect(
      findAuditChainBreak([first, { ...second, payload: { b: 3 } }, third])
    ).toBe(2)
  })

  it('hashes key order independently', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 1 }] })).toBe(
      '{"a":[{"c":1,"d":2}],"b":1}'
    )
  })
})

describe('email and consent helpers', () => {
  it('escapes directory and user text before it enters HTML', () => {
    expect(escapeHtml('<b>"A" & \'B\'</b>')).toBe(
      '&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;'
    )
  })

  it('hashes the consent text deterministically', () => {
    expect(consentTextSha256('x')).toBe(consentTextSha256('x'))
    expect(consentTextSha256()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes a provider snapshot independent of key order', () => {
    expect(snapshotSha256({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(
      snapshotSha256({ a: [2, { c: 4, d: 3 }], b: 1 })
    )
  })
})
