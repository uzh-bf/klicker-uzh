import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'

const serviceMocks = vi.hoisted(() => ({
  approveResponseExample: vi.fn(),
  captureResponseExample: vi.fn(),
  editAndApproveResponseExample: vi.fn(),
  rejectResponseExample: vi.fn(),
}))

vi.mock('../src/services/responseExamples.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...serviceMocks,
}))

type ResponseExampleMutation = keyof typeof serviceMocks

const mutationArguments: Record<ResponseExampleMutation, string> = {
  approveResponseExample: 'id: "example-id"',
  captureResponseExample:
    'chatbotId: "00000000-0000-4000-8000-000000000001", receipt: "receipt", question: "Question", answer: "Answer [1]."',
  editAndApproveResponseExample:
    'id: "example-id", chatMode: "tutor", studentMessage: "Question", referenceAnswer: "Answer [1].", responseStyle: CONCISE_ANSWER, expectedUpdatedAt: "2026-08-26T12:00:00Z"',
  rejectResponseExample: 'id: "example-id"',
}

const mutationSelection: Record<ResponseExampleMutation, string> = {
  approveResponseExample: 'id',
  captureResponseExample: 'exampleId created',
  editAndApproveResponseExample: 'id',
  rejectResponseExample: 'id',
}

function buildContext(scope: UserLoginScope): ContextWithUser {
  return {
    prisma: {},
    user: {
      sub: '00000000-0000-4000-8000-000000000001',
      role: UserRole.USER,
      scope,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as ContextWithUser
}

async function executeMutation(
  field: ResponseExampleMutation,
  scope: UserLoginScope
) {
  const yoga = createYoga({
    schema,
    context: () => buildContext(scope),
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `mutation { ${field}(${mutationArguments[field]}) { ${mutationSelection[field]} } }`,
    }),
  })
  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string }[]
  }
}

describe('response-example mutation authorization', () => {
  beforeEach(() => {
    for (const mock of Object.values(serviceMocks)) {
      mock.mockReset()
      mock.mockResolvedValue({ id: 'set-id' })
    }
    serviceMocks.captureResponseExample.mockResolvedValue({
      exampleId: '00000000-0000-4000-8000-000000000002',
      created: true,
    })
  })

  it.each([
    UserLoginScope.READ_ONLY,
    UserLoginScope.SESSION_EXEC,
  ])('rejects %s delegated access before the service', async (scope) => {
    for (const field of Object.keys(
      serviceMocks
    ) as ResponseExampleMutation[]) {
      const result = await executeMutation(field, scope)

      expect(result.errors?.[0]?.message, field).toBe('Unauthorized')
      expect(serviceMocks[field], field).not.toHaveBeenCalled()
    }
  })

  it('lets a full-access lecturer reach each mutation service', async () => {
    for (const field of Object.keys(
      serviceMocks
    ) as ResponseExampleMutation[]) {
      const result = await executeMutation(field, UserLoginScope.FULL_ACCESS)

      expect(result.errors, field).toBeUndefined()
      expect(serviceMocks[field], field).toHaveBeenCalledTimes(1)
    }
  })

  it('lets the account owner reach response-example capture', async () => {
    const result = await executeMutation(
      'captureResponseExample',
      UserLoginScope.ACCOUNT_OWNER
    )

    expect(result.errors).toBeUndefined()
    expect(serviceMocks.captureResponseExample).toHaveBeenCalledOnce()
  })
})
