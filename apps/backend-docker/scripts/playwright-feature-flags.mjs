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

process.env.GROWTHBOOK_API_HOST = 'https://growthbook.test'
process.env.GROWTHBOOK_CLIENT_KEY = 'sdk-test'
process.env.GROWTHBOOK_ENV = 'test'

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
    },
  }
}

const originalFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url === fixtureUrl) {
    return Promise.resolve(Response.json(featurePayload()))
  }
  return originalFetch(input, init)
}
