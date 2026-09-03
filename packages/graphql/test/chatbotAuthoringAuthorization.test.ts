import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const serviceMocks = vi.hoisted(() => ({
  updateChatbotModelSettings: vi.fn(),
  updateChatbotStandardModeConfig: vi.fn(),
}))

vi.mock('../src/services/chatbots.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/chatbots.js')>()),
  updateChatbotModelSettings: serviceMocks.updateChatbotModelSettings,
  updateChatbotStandardModeConfig: serviceMocks.updateChatbotStandardModeConfig,
}))

import '../src/schema/mutation.js'
import { schema } from '../src/index.js'

function buildContext({
  scope,
  catalyst,
}: {
  scope: UserLoginScope
  catalyst: boolean
}) {
  return {
    user: {
      sub: '00000000-0000-4000-8000-000000000001',
      role: UserRole.USER,
      scope,
      catalystIndividual: catalyst,
      catalystInstitutional: false,
    },
  } as ContextWithUser
}

async function executeMutation(context: ContextWithUser) {
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
          updateChatbotModelSettings(
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
            config: { tutorEnabled: true, explainerEnabled: false }
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
