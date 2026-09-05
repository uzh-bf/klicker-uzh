import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const serviceMocks = vi.hoisted(() => ({
  updateChatbotModelSettings: vi.fn(),
  updateChatbotModelPolicy: vi.fn(),
  updateChatbotStandardModeConfig: vi.fn(),
  createChatbot: vi.fn(),
  updateChatbot: vi.fn(),
  saveChatbotDisclaimer: vi.fn(),
  requestChatbotPublication: vi.fn(),
  getChatbotPublishingCapability: vi.fn(),
}))

vi.mock('../src/services/chatbots.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/chatbots.js')>()),
  ...serviceMocks,
}))

import '../src/schema/mutation.js'
import { schema } from '../src/index.js'
import { getChatbotsInfo } from '../src/services/chatbots.js'

describe('AI beta listing boundary', () => {
  it.each([
    'missing',
    'off',
    'throwing',
  ] as const)('returns no data before Prisma access with a %s evaluator', async (state) => {
    const ctx = buildContext({
      scope: UserLoginScope.FULL_ACCESS,
      catalyst: true,
    })
    if (state === 'missing') {
      delete ctx.featureFlags
    } else {
      ctx.featureFlags = {
        refresh: async () => {},
        isEnabled: () => {
          if (state === 'throwing')
            throw new Error('Synthetic evaluator failure')
          return false
        },
      } as NonNullable<ContextWithUser['featureFlags']>
    }
    const read = vi.fn(() => {
      throw new Error('Unexpected Prisma access')
    })
    Object.defineProperty(ctx, 'prisma', { get: read })
    expect(await getChatbotsInfo(ctx)).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })
})

describe('AI beta authoring field boundary', () => {
  const operations = [
    {
      field: 'updateChatbotModelSettings',
      query:
        'mutation { updateChatbotModelSettings(chatbotId: "synthetic-chatbot", modelSelection: false, allowedModelIds: []) { id } }',
    },
    {
      field: 'updateChatbotModelPolicy',
      query:
        'mutation { updateChatbotModelPolicy(chatbotId: "synthetic-chatbot", modelSelection: false, allowedModelIds: []) { id } }',
    },
    {
      field: 'updateChatbotStandardModeConfig',
      query:
        'mutation { updateChatbotStandardModeConfig(chatbotId: "synthetic-chatbot", config: { tutorEnabled: true, explainerEnabled: false, quizzerEnabled: false }) { id } }',
    },
    {
      field: 'createChatbot',
      query:
        'mutation { createChatbot(name: "Synthetic bot", courseId: "synthetic-course") { id } }',
    },
    {
      field: 'updateChatbot',
      query:
        'mutation { updateChatbot(id: "synthetic-chatbot", name: "Updated synthetic bot") { id } }',
    },
    {
      field: 'saveChatbotDisclaimer',
      query:
        'mutation { saveChatbotDisclaimer(chatbotId: "synthetic-chatbot", title: "Synthetic notice", introText: "Synthetic notice") { id } }',
    },
    {
      field: 'requestChatbotPublication',
      query:
        'mutation { requestChatbotPublication(id: "synthetic-chatbot", useCase: "Synthetic test", expectedStudentCount: 1, proposedCredits: 1) { id } }',
    },
    {
      field: 'getChatbotPublishingCapability',
      query: 'query { getChatbotPublishingCapability }',
    },
  ] as const

  beforeEach(() => {
    for (const mock of Object.values(serviceMocks)) {
      mock.mockReset()
      mock.mockResolvedValue({ id: 'synthetic-chatbot' })
    }
    serviceMocks.getChatbotPublishingCapability.mockResolvedValue(true)
  })

  describe.each(operations)('$field', ({ field, query }) => {
    async function execute(context: ContextWithUser) {
      const yoga = createYoga({ schema, context: () => context })
      const response = await yoga.fetch('http://localhost/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      return (await response.json()) as {
        data?: Record<string, unknown>
        errors?: { message: string }[]
      }
    }

    it.each([
      'missing',
      'off',
      'throwing',
    ] as const)('denies a %s evaluator before invoking the service', async (state) => {
      const ctx = buildContext({
        scope: UserLoginScope.FULL_ACCESS,
        catalyst: true,
      })
      if (state === 'missing') {
        delete ctx.featureFlags
      } else {
        ctx.featureFlags = {
          refresh: async () => {},
          isEnabled: () => {
            if (state === 'throwing')
              throw new Error('Synthetic evaluator failure')
            return false
          },
        } as NonNullable<ContextWithUser['featureFlags']>
      }
      const result = await execute(ctx)
      expect(result.errors?.[0]?.message).toBe('Unauthorized')
      expect(serviceMocks[field]).not.toHaveBeenCalled()
    })

    it('allows an eligible lecturer when AI beta is enabled', async () => {
      const result = await execute(
        buildContext({
          scope: UserLoginScope.FULL_ACCESS,
          catalyst: true,
        })
      )
      expect(result.errors).toBeUndefined()
      expect(serviceMocks[field]).toHaveBeenCalledOnce()
    })

    it.each([
      { scope: UserLoginScope.READ_ONLY, catalyst: true, role: UserRole.USER },
      {
        scope: UserLoginScope.FULL_ACCESS,
        catalyst: false,
        role: UserRole.USER,
      },
      {
        scope: UserLoginScope.FULL_ACCESS,
        catalyst: true,
        role: UserRole.PARTICIPANT,
      },
    ])('preserves existing authorization for $scope/$catalyst/$role', async ({
      scope,
      catalyst,
      role,
    }) => {
      const ctx = buildContext({ scope, catalyst })
      ctx.user.role = role
      const result = await execute(ctx)
      expect(result.errors?.[0]?.message).toBe('Unauthorized')
      expect(serviceMocks[field]).not.toHaveBeenCalled()
    })
  })
})

function buildContext({
  scope,
  catalyst,
}: {
  scope: UserLoginScope
  catalyst: boolean
}) {
  return {
    featureFlags: { isEnabled: () => true, refresh: async () => {} },
    user: {
      sub: '00000000-0000-4000-8000-000000000001',
      role: UserRole.USER,
      scope,
      catalystIndividual: catalyst,
      catalystInstitutional: false,
    },
  } as unknown as ContextWithUser
}

async function executeMutation(
  context: ContextWithUser,
  field:
    | 'updateChatbotModelSettings'
    | 'updateChatbotModelPolicy' = 'updateChatbotModelSettings'
) {
  const yoga = createYoga({
    schema,
    context: () => context,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation {
          ${field}(
            chatbotId: "00000000-0000-4000-8000-000000000002"
            modelSelection: false
            allowedModelIds: []
          ) {
            id
          }
        }
      `,
    }),
  })
  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string }[]
  }
}

async function executeStandardModeMutation(context: ContextWithUser) {
  const yoga = createYoga({
    schema,
    context: () => context,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation {
          updateChatbotStandardModeConfig(
            chatbotId: "00000000-0000-4000-8000-000000000002"
            config: {
              tutorEnabled: true
              explainerEnabled: false
              quizzerEnabled: false
            }
          ) {
            id
          }
        }
      `,
    }),
  })
  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string }[]
  }
}

describe('chatbot authoring authorization', () => {
  beforeEach(() => {
    serviceMocks.updateChatbotModelSettings.mockReset()
    serviceMocks.updateChatbotModelSettings.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
    })
    serviceMocks.updateChatbotModelPolicy.mockReset()
    serviceMocks.updateChatbotModelPolicy.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
    })
    serviceMocks.updateChatbotStandardModeConfig.mockReset()
    serviceMocks.updateChatbotStandardModeConfig.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
    })
  })

  it.each([
    UserLoginScope.ACCOUNT_OWNER,
    UserLoginScope.FULL_ACCESS,
  ])('allows Catalyst users with %s scope', async (scope) => {
    const result = await executeMutation(
      buildContext({ scope, catalyst: true })
    )

    expect(result.errors).toBeUndefined()
    expect(serviceMocks.updateChatbotModelSettings).toHaveBeenCalledOnce()
  })

  it.each([
    UserLoginScope.SESSION_EXEC,
    UserLoginScope.READ_ONLY,
  ])('rejects Catalyst users with %s scope', async (scope) => {
    const result = await executeMutation(
      buildContext({ scope, catalyst: true })
    )

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.updateChatbotModelSettings).not.toHaveBeenCalled()
  })

  it.each([
    UserLoginScope.ACCOUNT_OWNER,
    UserLoginScope.FULL_ACCESS,
  ])('allows standard mode configuration for Catalyst users with %s scope', async (scope) => {
    const result = await executeStandardModeMutation(
      buildContext({ scope, catalyst: true })
    )

    expect(result.errors).toBeUndefined()
    expect(serviceMocks.updateChatbotStandardModeConfig).toHaveBeenCalledOnce()
  })

  it.each([
    UserLoginScope.SESSION_EXEC,
    UserLoginScope.READ_ONLY,
  ])('rejects standard mode configuration for Catalyst users with %s scope', async (scope) => {
    const result = await executeStandardModeMutation(
      buildContext({ scope, catalyst: true })
    )

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.updateChatbotStandardModeConfig).not.toHaveBeenCalled()
  })

  it.each([
    UserLoginScope.ACCOUNT_OWNER,
    UserLoginScope.FULL_ACCESS,
    UserLoginScope.SESSION_EXEC,
    UserLoginScope.READ_ONLY,
  ])('rejects non-Catalyst users with %s scope', async (scope) => {
    const result = await executeMutation(
      buildContext({ scope, catalyst: false })
    )

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.updateChatbotModelSettings).not.toHaveBeenCalled()
  })

  it.each([
    UserLoginScope.ACCOUNT_OWNER,
    UserLoginScope.FULL_ACCESS,
  ])('allows strict model policy updates for Catalyst users with %s scope', async (scope) => {
    const result = await executeMutation(
      buildContext({ scope, catalyst: true }),
      'updateChatbotModelPolicy'
    )

    expect(result.errors).toBeUndefined()
    expect(serviceMocks.updateChatbotModelPolicy).toHaveBeenCalledOnce()
  })

  it.each([
    UserLoginScope.SESSION_EXEC,
    UserLoginScope.READ_ONLY,
  ])('rejects strict model policy updates for Catalyst users with %s scope', async (scope) => {
    const result = await executeMutation(
      buildContext({ scope, catalyst: true }),
      'updateChatbotModelPolicy'
    )

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.updateChatbotModelPolicy).not.toHaveBeenCalled()
  })

  it.each([
    UserLoginScope.ACCOUNT_OWNER,
    UserLoginScope.FULL_ACCESS,
    UserLoginScope.SESSION_EXEC,
    UserLoginScope.READ_ONLY,
  ])('rejects strict model policy updates for non-Catalyst users with %s scope', async (scope) => {
    const result = await executeMutation(
      buildContext({ scope, catalyst: false }),
      'updateChatbotModelPolicy'
    )

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.updateChatbotModelPolicy).not.toHaveBeenCalled()
  })

  it.each([
    UserLoginScope.ACCOUNT_OWNER,
    UserLoginScope.FULL_ACCESS,
    UserLoginScope.SESSION_EXEC,
    UserLoginScope.READ_ONLY,
  ])('rejects standard mode configuration for non-Catalyst users with %s scope', async (scope) => {
    const result = await executeStandardModeMutation(
      buildContext({ scope, catalyst: false })
    )

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.updateChatbotStandardModeConfig).not.toHaveBeenCalled()
  })
})
