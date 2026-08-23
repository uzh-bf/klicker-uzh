import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const serviceMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}))

vi.mock('../src/services/email.js', () => ({
  sendEmail: serviceMocks.sendEmail,
}))

import '../src/schema/mutation.js'
import { schema } from '../src/index.js'

const ownerSub = '00000000-0000-4000-8000-000000000001'

function buildContext({
  scope,
  withEmail = true,
}: {
  scope: UserLoginScope
  withEmail?: boolean
}) {
  const prismaUserFindUnique = vi.fn().mockResolvedValue(
    withEmail
      ? {
          id: ownerSub,
          email: 'requester@example.com',
          firstName: 'Test',
          lastName: 'Requester',
        }
      : { id: ownerSub, email: null }
  )

  return {
    prisma: {
      user: {
        findUnique: prismaUserFindUnique,
      },
    },
    user: {
      sub: ownerSub,
      role: UserRole.USER,
      scope,
      catalystIndividual: false,
      catalystInstitutional: false,
    },
  } as ContextWithUser & {
    prisma: { user: { findUnique: typeof prismaUserFindUnique } }
  }
}

async function executeMutation(
  context: ContextWithUser,
  variables?: Record<string, unknown>
) {
  const source = `
    mutation Request($institution: String!, $useCase: String!) {
      requestCatalystAccess(institution: $institution, useCase: $useCase)
    }
  `
  const yoga = createYoga({
    schema,
    context: () => context,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: source,
      variables: variables ?? {
        institution: 'Synthetic University',
        useCase:
          'Evaluating KlickerUZH for a synthetic teaching pilot in one course.',
      },
    }),
  })
  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string; extensions?: { code?: string } }[]
  }
}

describe('Catalyst access request', () => {
  beforeEach(() => {
    serviceMocks.sendEmail.mockReset()
    serviceMocks.sendEmail.mockResolvedValue(true)
  })

  it('rejects full-access delegated logins at the gate', async () => {
    const context = buildContext({ scope: UserLoginScope.FULL_ACCESS })
    const result = await executeMutation(context)
    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.sendEmail).not.toHaveBeenCalled()
  })

  it('rejects read-only logins at the gate', async () => {
    const context = buildContext({ scope: UserLoginScope.READ_ONLY })
    const result = await executeMutation(context)
    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.sendEmail).not.toHaveBeenCalled()
  })

  it('rejects session-executive logins at the gate', async () => {
    const context = buildContext({ scope: UserLoginScope.SESSION_EXEC })
    const result = await executeMutation(context)
    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.sendEmail).not.toHaveBeenCalled()
  })

  it('sends exactly one email for an account owner and returns true', async () => {
    const context = buildContext({ scope: UserLoginScope.ACCOUNT_OWNER })
    const result = await executeMutation(context, {
      institution: '  Synthetic University  ',
      useCase:
        '  Evaluating KlickerUZH for a synthetic teaching pilot in one course.  ',
    })
    expect(result.errors).toBeUndefined()
    expect(result.data?.requestCatalystAccess).toBe(true)
    expect(serviceMocks.sendEmail).toHaveBeenCalledTimes(1)
    const mailArgs = serviceMocks.sendEmail.mock.calls[0]?.[0] as {
      to: string
      subject: string
      text: string
      html: string
      replyTo?: string
    }
    expect(mailArgs.to).toBe('klicker@df.uzh.ch')
    expect(mailArgs.replyTo).toBe('requester@example.com')
    expect(mailArgs.text).toContain('Institution: Synthetic University')
    expect(mailArgs.text).toContain(
      'Intended use: Evaluating KlickerUZH for a synthetic teaching pilot in one course.'
    )
  })

  it('escapes HTML-sensitive characters in user-controlled fields', async () => {
    const context = buildContext({ scope: UserLoginScope.ACCOUNT_OWNER })
    await executeMutation(context, {
      institution: '<script>alert("x")</script> & Co',
      useCase:
        'Testing <b>escaping</b> of <img src=x onerror=alert(1)> payloads thoroughly.',
    })
    const mailArgs = serviceMocks.sendEmail.mock.calls[0]?.[0] as {
      to: string
      subject: string
      text: string
      html: string
      replyTo?: string
    }
    expect(mailArgs.html).not.toContain('<script>')
    expect(mailArgs.html).toContain('&lt;script&gt;')
    expect(mailArgs.html).toContain('&amp; Co')
    expect(mailArgs.html).toContain('&lt;b&gt;escaping&lt;/b&gt;')
  })

  it('returns a stable values-free error when the transport fails', async () => {
    const context = buildContext({ scope: UserLoginScope.ACCOUNT_OWNER })
    serviceMocks.sendEmail.mockResolvedValue(false)
    const result = await executeMutation(context)
    expect(result.errors?.[0]?.extensions?.code).toBe('INTERNAL_SERVER_ERROR')
    expect(result.data?.requestCatalystAccess).toBeUndefined()
  })

  it('fails closed without exposing internals when the account has no email', async () => {
    const context = buildContext({
      scope: UserLoginScope.ACCOUNT_OWNER,
      withEmail: false,
    })
    const result = await executeMutation(context)
    expect(result.errors?.[0]?.message).toBe('Unauthorized')
    expect(serviceMocks.sendEmail).not.toHaveBeenCalled()
  })
})
