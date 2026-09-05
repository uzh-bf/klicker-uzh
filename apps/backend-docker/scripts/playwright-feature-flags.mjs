// Loaded only by start:test. Exercise the real GrowthBook evaluator without
// contacting a flag service or enabling AI beta for arbitrary accounts.
if (process.env.NODE_ENV !== 'test') {
  throw new Error('The Playwright flag fixture requires NODE_ENV=test')
}

const fixtureUrl = 'https://growthbook.test/api/features/sdk-test'
process.env.GROWTHBOOK_API_HOST = 'https://growthbook.test'
process.env.GROWTHBOOK_CLIENT_KEY = 'sdk-test'
process.env.GROWTHBOOK_ENV = 'test'

const originalFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url !== fixtureUrl) return originalFetch(input, init)

  return Promise.resolve(
    Response.json({
      features: {
        'ai-beta': {
          defaultValue: false,
          rules: [
            {
              condition: {
                // USER_ID_TEST from playwright/util/constants.ts, synthetic only.
                id: '76047345-3801-4628-ae7b-adbebcfe8821',
                actorType: 'user',
                catalyst: true,
                environment: 'test',
              },
              force: true,
            },
          ],
        },
      },
    })
  )
}
