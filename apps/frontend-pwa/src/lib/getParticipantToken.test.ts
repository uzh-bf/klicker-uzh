import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { signJWT } from '@klicker-uzh/util'
import type { GetServerSidePropsContext } from 'next'
import getParticipantToken from './getParticipantToken'

type CookieHeader = string | string[] | number | undefined

function createContext({
  cookie,
  query = {},
}: {
  cookie?: string
  query?: GetServerSidePropsContext['query']
} = {}) {
  let setCookie: CookieHeader
  const res = {
    finished: false,
    getHeader(name: string) {
      return name.toLowerCase() === 'set-cookie' ? setCookie : undefined
    },
    setHeader(name: string, value: CookieHeader) {
      if (name.toLowerCase() === 'set-cookie') setCookie = value
    },
  }

  return {
    ctx: {
      req: { headers: { cookie } },
      res,
      query,
    } as unknown as GetServerSidePropsContext,
    res,
  }
}

function createApolloClient(
  mutate: (options: {
    variables: Record<string, string | undefined>
  }) => Promise<unknown>
) {
  return { mutate } as unknown as ApolloClient<NormalizedCacheObject>
}

async function withEnvironment<T>(
  values: Record<string, string>,
  callback: () => Promise<T>
) {
  const previous = new Map<string, string | undefined>()

  for (const [name, value] of Object.entries(values)) {
    previous.set(name, process.env[name])
    process.env[name] = value
  }

  try {
    return await callback()
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

describe('getParticipantToken', () => {
  it('rejects empty attempted LTI values without fallback', async () => {
    for (const input of [
      {
        cookie:
          'participant_token=existing; ' +
          'temporary_participant_token=guest; lti-token=',
        query: {},
      },
      {
        cookie: 'participant_token=existing; temporary_participant_token=guest',
        query: { jwt: '' },
      },
    ]) {
      const { ctx } = createContext(input)
      let mutationCalls = 0
      const apolloClient = createApolloClient(async () => {
        mutationCalls += 1
        throw new Error('LTI mutation should not run for an empty token')
      })

      await assert.rejects(
        getParticipantToken({ apolloClient, courseId: 'course-1', ctx }),
        (error: unknown) =>
          error instanceof Error &&
          error.message === 'LTI_AUTHENTICATION_FAILED'
      )
      assert.equal(mutationCalls, 0)
    }
  })

  it('exchanges valid LTI data and keeps the partitioned cookie', async () => {
    await withEnvironment(
      {
        APP_SECRET: 'synthetic-lti-test-secret',
        COOKIE_DOMAIN: 'pwa.example.test',
        NODE_ENV: 'production',
        ASSESSMENT_MODE: 'false',
      },
      async () => {
        const ltiToken = await signJWT(
          {
            sub: 'synthetic-lti-user',
            email: 'synthetic@example.test',
            scope: 'LTI1.3',
          },
          'synthetic-lti-test-secret'
        )
        const { ctx, res } = createContext({ cookie: `lti-token=${ltiToken}` })
        const calls: Array<{
          variables: Record<string, string | undefined>
        }> = []
        const apolloClient = createApolloClient(async (options) => {
          calls.push(options)
          return {
            data: {
              loginParticipantWithLti: {
                participant: { id: 'participant-1' },
                participantToken: 'participant-token',
              },
            },
          }
        })

        const result = await getParticipantToken({
          apolloClient,
          courseId: 'course-1',
          ctx,
        })

        assert.equal(result.participantToken, 'participant-token')
        assert.equal(result.cookiesAvailable, true)
        assert.deepEqual(calls[0]?.variables, {
          signedLtiData: ltiToken,
          courseId: 'course-1',
        })

        const cookies = res.getHeader('Set-Cookie')
        assert.ok(Array.isArray(cookies))
        const participantCookie = cookies.find((cookie) =>
          cookie.startsWith('participant_token=participant-token')
        )
        assert.ok(participantCookie)
        assert.match(participantCookie, /; SameSite=None/)
        assert.match(participantCookie, /; Secure/)
        assert.match(participantCookie, /; Partitioned/)
      }
    )
  })

  it('rejects a failed LTI exchange without cookie fallback', async () => {
    await withEnvironment(
      {
        APP_SECRET: 'synthetic-lti-test-secret',
        ASSESSMENT_MODE: 'false',
      },
      async () => {
        const ltiToken = await signJWT(
          {
            sub: 'synthetic-lti-user',
            email: 'synthetic@example.test',
            scope: 'LTI1.3',
          },
          'synthetic-lti-test-secret'
        )

        for (const exchangeResult of [
          { data: { loginParticipantWithLti: null } },
          new Error('synthetic LTI exchange failure'),
        ]) {
          const { ctx } = createContext({
            cookie:
              'participant_token=existing; ' +
              'temporary_participant_token=guest; ' +
              `lti-token=${ltiToken}`,
          })
          const apolloClient = createApolloClient(async () => {
            if (exchangeResult instanceof Error) throw exchangeResult
            return exchangeResult
          })

          await assert.rejects(
            getParticipantToken({
              apolloClient,
              courseId: 'course-1',
              ctx,
            }),
            (error: unknown) =>
              error instanceof Error &&
              error.message === 'LTI_AUTHENTICATION_FAILED'
          )
        }
      }
    )
  })

  it('returns a query LTI session when cookies are unavailable', async () => {
    await withEnvironment(
      {
        APP_SECRET: 'synthetic-lti-test-secret',
        ASSESSMENT_MODE: 'false',
      },
      async () => {
        const ltiToken = await signJWT(
          {
            sub: 'synthetic-lti-user',
            email: 'synthetic@example.test',
            scope: 'LTI1.3',
          },
          'synthetic-lti-test-secret'
        )
        const { ctx } = createContext({ query: { jwt: ltiToken } })
        const apolloClient = createApolloClient(async () => ({
          data: {
            loginParticipantWithLti: {
              participant: { id: 'participant-1' },
              participantToken: 'participant-token',
            },
          },
        }))

        const result = await getParticipantToken({
          apolloClient,
          courseId: 'course-1',
          ctx,
        })

        assert.equal(result.cookiesAvailable, false)
        assert.equal(result.participantToken, 'participant-token')
      }
    )
  })

  it('returns an existing token without an LTI attempt', async () => {
    await withEnvironment({ ASSESSMENT_MODE: 'false' }, async () => {
      const { ctx } = createContext({
        cookie:
          'participant_token=existing-participant; ' +
          'temporary_participant_token=guest',
      })
      const apolloClient = createApolloClient(async () => {
        throw new Error('existing participant tokens should bypass LTI login')
      })

      const result = await getParticipantToken({ apolloClient, ctx })

      assert.deepEqual(result, {
        participantToken: 'existing-participant',
        cookiesAvailable: true,
      })
    })
  })
})
