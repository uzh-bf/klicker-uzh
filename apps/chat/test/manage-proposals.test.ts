import { signJWT } from '@klicker-uzh/util'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  buildManageProposalGraphqlRequest,
  confirmManageProposal,
  getRequiredManageOrigin,
  recordProposalConfirmationAudit,
  verifyManageProposalToken,
  type ManageElementCreateProposal,
} from '../src/services/manageProposals'

const mockAuditLogEntryCreate = vi.fn()

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    auditLogEntry: {
      create: (...args: unknown[]) => mockAuditLogEntryCreate(...args),
    },
  },
}))

const proposalPayload = {
  basePoints: true,
  content: 'What does standard deviation measure?',
  explanation: 'Standard deviation summarizes dispersion.',
  name: 'Standard deviation interpretation',
  options: {
    choices: [
      {
        correct: true,
        feedback: 'Correct: standard deviation measures spread.',
        value: 'Variation or dispersion in the data',
      },
      { correct: false, value: 'The average value' },
    ],
    displayMode: 'LIST',
    hasAnswerFeedbacks: true,
    hasSampleSolution: true,
  },
  pointsMultiplier: 1,
  status: 'DRAFT',
  tags: ['statistics'],
  type: 'MC',
} satisfies ManageElementCreateProposal['payload']

const proposal = {
  kind: 'element.create.proposal',
  payload: proposalPayload,
  requiresConfirmation: true,
  summary: 'Create DRAFT MC question',
} satisfies ManageElementCreateProposal

describe('Manage proposal confirmation helpers', () => {
  afterEach(() => {
    mockAuditLogEntryCreate.mockReset()
  })

  test('builds a persisted DRAFT choices-question mutation request', () => {
    const request = buildManageProposalGraphqlRequest(proposal)

    expect(request.operationName).toBe('ManipulateChoicesQuestion')
    expect(request.variables).toMatchObject({
      basePoints: true,
      content: 'What does standard deviation measure?',
      explanation: 'Standard deviation summarizes dispersion.',
      name: 'Standard deviation interpretation',
      pointsMultiplier: 1,
      status: 'DRAFT',
      tags: ['statistics'],
      type: 'MC',
    })
    expect(request.variables).not.toHaveProperty('id')
    const variables = request.variables as {
      options: { choices: Array<Record<string, unknown>> }
    }
    expect(variables.options.choices[0]).toMatchObject({
      correct: true,
      feedback: 'Correct: standard deviation measures spread.',
      ix: 0,
      value: 'Variation or dispersion in the data',
    })
    expect(request.extensions.persistedQuery.sha256Hash).toMatch(
      /^[a-f0-9]{64}$/
    )
    expect(request).not.toHaveProperty('query')
  })

  test('requires an explicit Manage origin for proposal confirmation', () => {
    expect(() => getRequiredManageOrigin({})).toThrow(
      'APP_ORIGIN_MANAGE is required'
    )
    expect(
      getRequiredManageOrigin({ APP_ORIGIN_MANAGE: 'https://manage.test/' })
    ).toBe('https://manage.test')
  })

  test('rejects non-DRAFT proposal payloads', () => {
    expect(() =>
      buildManageProposalGraphqlRequest({
        kind: 'element.create.proposal',
        payload: {
          content: 'Publish me',
          name: 'Unsafe status',
          options: {
            choices: [
              { correct: true, value: 'Correct' },
              { correct: false, value: 'Incorrect' },
            ],
            displayMode: 'LIST',
            hasAnswerFeedbacks: false,
            hasSampleSolution: true,
          },
          status: 'READY',
          type: 'SC',
        },
        requiresConfirmation: true,
      })
    ).toThrow('Invalid Manage proposal payload')
  })

  test('verifies signed proposal tokens for the current lecturer only', async () => {
    const token = await signJWT(
      {
        kind: proposal.kind,
        payload: proposal.payload,
        purpose: 'manage-assistant-proposal',
        summary: proposal.summary,
        sub: 'lecturer-1',
      },
      'proposal-secret',
      { expiresIn: '15m', issuer: 'https://auth.test' }
    )

    await expect(
      verifyManageProposalToken(token, 'lecturer-1', {
        issuer: 'https://auth.test',
        secret: 'proposal-secret',
      })
    ).resolves.toMatchObject(proposal)

    await expect(
      verifyManageProposalToken(token, 'lecturer-2', {
        issuer: 'https://auth.test',
        secret: 'proposal-secret',
      })
    ).rejects.toThrow('Invalid Manage proposal token')
  })

  test('rejects a signed proposal token that was already confirmed once', async () => {
    const token = await signJWT(
      {
        jti: crypto.randomUUID(),
        kind: proposal.kind,
        payload: proposal.payload,
        purpose: 'manage-assistant-proposal',
        summary: proposal.summary,
        sub: 'lecturer-replay',
      },
      'proposal-secret',
      { expiresIn: '15m', issuer: 'https://auth.test' }
    )
    const settings = { issuer: 'https://auth.test', secret: 'proposal-secret' }

    await expect(
      verifyManageProposalToken(token, 'lecturer-replay', settings)
    ).resolves.toMatchObject(proposal)

    await expect(
      verifyManageProposalToken(token, 'lecturer-replay', settings)
    ).rejects.toThrow('Manage proposal token already used')
  })

  test('accepts repeat confirmation of a token signed without a jti (pre-rollout)', async () => {
    const token = await signJWT(
      {
        kind: proposal.kind,
        payload: proposal.payload,
        purpose: 'manage-assistant-proposal',
        summary: proposal.summary,
        sub: 'lecturer-no-jti',
      },
      'proposal-secret',
      { expiresIn: '15m', issuer: 'https://auth.test' }
    )
    const settings = { issuer: 'https://auth.test', secret: 'proposal-secret' }

    // No jti claim -> no replay guard available, so verification succeeds
    // every time (matches the old, pre-rollout signer's behavior).
    await expect(
      verifyManageProposalToken(token, 'lecturer-no-jti', settings)
    ).resolves.toMatchObject(proposal)

    await expect(
      verifyManageProposalToken(token, 'lecturer-no-jti', settings)
    ).resolves.toMatchObject(proposal)
  })

  test('confirms proposals through the Manage GraphQL endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          manipulateChoicesQuestion: {
            id: 42,
            name: 'Standard deviation interpretation',
            status: 'DRAFT',
            type: 'MC',
          },
        },
      }),
      ok: true,
      status: 200,
    })

    await expect(
      confirmManageProposal({
        fetchImpl,
        graphqlEndpoint: 'https://api.test/api/graphql',
        manageOrigin: 'https://manage.test',
        proposal,
        sessionToken: 'session-token',
      })
    ).resolves.toEqual({
      element: {
        id: 42,
        name: 'Standard deviation interpretation',
        status: 'DRAFT',
        type: 'MC',
      },
    })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.test/api/graphql')
    expect(init).toMatchObject({
      headers: {
        authorization: 'Bearer session-token',
        cookie: 'next-auth.session-token=session-token',
        origin: 'https://manage.test',
        'x-graphql-yoga-csrf': 'true',
      },
      method: 'POST',
    })
    expect(JSON.parse(init.body).operationName).toBe(
      'ManipulateChoicesQuestion'
    )
  })
})

describe('recordProposalConfirmationAudit (extension roadmap X5)', () => {
  afterEach(() => {
    mockAuditLogEntryCreate.mockReset()
  })

  test('writes an ASSISTANT_PROPOSAL_CONFIRMED audit entry with a short, PII-free message', async () => {
    mockAuditLogEntryCreate.mockResolvedValue({ id: 1 })

    await recordProposalConfirmationAudit({
      jti: 'jti-123',
      kind: 'element.create.proposal',
      objectId: '42',
      summary: 'Create DRAFT MC question',
      userId: 'lecturer-1',
    })

    expect(mockAuditLogEntryCreate).toHaveBeenCalledTimes(1)
    const [{ data }] = mockAuditLogEntryCreate.mock.calls[0]
    expect(data).toMatchObject({
      objectId: '42',
      objectType: 'ELEMENT',
      sourceUserId: 'lecturer-1',
      type: 'ASSISTANT_PROPOSAL_CONFIRMED',
    })
    expect(JSON.parse(data.message)).toEqual({
      jti: 'jti-123',
      kind: 'element.create.proposal',
      summary: 'Create DRAFT MC question',
    })
    // No full payload dump — only kind/jti/summary in the message.
    expect(data.message).not.toMatch(/standard deviation/i)
  })

  test('normalizes a legacy no-jti proposal to jti: null in the message', async () => {
    mockAuditLogEntryCreate.mockResolvedValue({ id: 2 })

    await recordProposalConfirmationAudit({
      jti: null,
      kind: 'element.create.proposal',
      objectId: '7',
      summary: undefined,
      userId: 'lecturer-2',
    })

    const [{ data }] = mockAuditLogEntryCreate.mock.calls[0]
    expect(JSON.parse(data.message)).toEqual({
      jti: null,
      kind: 'element.create.proposal',
      summary: null,
    })
  })

  test('is best-effort: a write failure is swallowed, not thrown', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockAuditLogEntryCreate.mockRejectedValue(new Error('DB unavailable'))

    await expect(
      recordProposalConfirmationAudit({
        jti: 'jti-456',
        kind: 'element.create.proposal',
        objectId: '9',
        summary: 'Create DRAFT SC question',
        userId: 'lecturer-3',
      })
    ).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record Manage-assistant proposal confirmation audit entry:',
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})

describe('verifyManageProposalToken jti surfacing (feeds the X5 audit trail)', () => {
  test('surfaces the signed jti for a fresh proposal token', async () => {
    const token = await signJWT(
      {
        jti: 'jti-fresh',
        kind: proposal.kind,
        payload: proposal.payload,
        purpose: 'manage-assistant-proposal',
        summary: proposal.summary,
        sub: 'lecturer-jti',
      },
      'proposal-secret',
      { expiresIn: '15m', issuer: 'https://auth.test' }
    )

    await expect(
      verifyManageProposalToken(token, 'lecturer-jti', {
        issuer: 'https://auth.test',
        secret: 'proposal-secret',
      })
    ).resolves.toMatchObject({ jti: 'jti-fresh' })
  })

  test('normalizes a legacy token with no jti claim to jti: null', async () => {
    const token = await signJWT(
      {
        kind: proposal.kind,
        payload: proposal.payload,
        purpose: 'manage-assistant-proposal',
        summary: proposal.summary,
        sub: 'lecturer-legacy',
      },
      'proposal-secret',
      { expiresIn: '15m', issuer: 'https://auth.test' }
    )

    await expect(
      verifyManageProposalToken(token, 'lecturer-legacy', {
        issuer: 'https://auth.test',
        secret: 'proposal-secret',
      })
    ).resolves.toMatchObject({ jti: null })
  })
})
