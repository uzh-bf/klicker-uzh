// Loaded only by test startup. Exercise the real GrowthBook evaluator without
// contacting a flag service, enabling AI beta for arbitrary accounts, or
// changing any production flag.
if (process.env.NODE_ENV !== 'test') {
  throw new Error('The Playwright flag fixture requires NODE_ENV=test')
}

const fixtureUrl = 'https://growthbook.test/api/features/sdk-test'
// USER_ID_TEST from playwright/util/constants.ts; synthetic only.
const enrolledLecturerId = '76047345-3801-4628-ae7b-adbebcfe8821'
const evaluationEnvironments = ['test', 'development']
let learningAnalyticsEnabled = true
// CI provides a loopback fixture whose non-AI flags can change during tests.
const configuredHost = process.env.GROWTHBOOK_API_HOST
const analyticsFixtureUrl = /^http:\/\/127\.0\.0\.1:\d+$/.test(
  configuredHost ?? ''
)
  ? `${configuredHost}/api/features/sdk-test`
  : undefined

process.env.GROWTHBOOK_API_HOST = 'https://growthbook.test'
process.env.GROWTHBOOK_CLIENT_KEY = 'sdk-test'
process.env.GROWTHBOOK_ENV = 'test'
process.env.GROWTHBOOK_REFRESH_INTERVAL_MS = '250'

function featurePayload() {
  return {
    features: {
      'ai-beta': {
        defaultValue: false,
        rules: [
          {
            condition: {
              id: enrolledLecturerId,
              actorType: 'user',
              catalyst: true,
              betaEnabled: true,
              environment: { $in: evaluationEnvironments },
            },
            force: true,
          },
        ],
      },
      'learning-analytics': {
        defaultValue: false,
        rules: [
          {
            condition: {
              id: enrolledLecturerId,
              actorType: 'user',
              environment: { $in: evaluationEnvironments },
            },
            force: learningAnalyticsEnabled,
          },
        ],
      },
    },
  }
}

const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url === fixtureUrl) {
    const payload = featurePayload()
    if (analyticsFixtureUrl) {
      const response = await originalFetch(analyticsFixtureUrl, init)
      if (!response.ok) return response
      const configuredPayload = await response.json()
      return Response.json({
        ...configuredPayload,
        features: {
          ...configuredPayload.features,
          ...payload.features,
          'learning-analytics': {
            ...configuredPayload.features?.['learning-analytics'],
            rules: [
              ...payload.features['learning-analytics'].rules,
              ...(configuredPayload.features?.['learning-analytics']?.rules ??
                []),
            ],
          },
        },
      })
    }
    return Response.json(payload)
  }

  let controllerUrl
  try {
    controllerUrl = new URL(url)
  } catch {
    return originalFetch(input, init)
  }

  if (
    controllerUrl.origin === 'https://growthbook.test' &&
    controllerUrl.pathname === '/__test/learning-analytics'
  ) {
    const method = String(
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()

    if (method === 'GET') {
      if (controllerUrl.search !== '') {
        return Promise.resolve(
          Response.json(
            {
              error:
                'The test fixture controller does not accept query parameters',
            },
            { status: 400 }
          )
        )
      }

      return Promise.resolve(
        Response.json({ enabled: learningAnalyticsEnabled })
      )
    }

    if (method === 'POST') {
      const queryEntries = [...controllerUrl.searchParams.entries()]
      const enabled = queryEntries[0]?.[1]
      if (
        queryEntries.length !== 1 ||
        queryEntries[0]?.[0] !== 'enabled' ||
        (enabled !== 'true' && enabled !== 'false')
      ) {
        return Promise.resolve(
          Response.json(
            {
              error:
                'The test fixture controller requires enabled=true or enabled=false',
            },
            { status: 400 }
          )
        )
      }

      learningAnalyticsEnabled = enabled === 'true'
      return Promise.resolve(
        Response.json({ enabled: learningAnalyticsEnabled })
      )
    }

    return Promise.resolve(
      Response.json({ error: 'Method not allowed' }, { status: 405 })
    )
  }

  return originalFetch(input, init)
}
