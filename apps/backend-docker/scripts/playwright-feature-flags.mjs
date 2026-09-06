// Loaded only by test startup. Exercise the real GrowthBook evaluator and the
// real beta enrollment service path without contacting a flag service,
// enabling AI beta for arbitrary accounts, or changing any production flag.
if (process.env.NODE_ENV !== 'test') {
  throw new Error('The Playwright flag fixture requires NODE_ENV=test')
}

const fixtureUrl = 'https://growthbook.test/api/features/sdk-test'
const savedGroupUrl =
  'https://growthbook.test/api/v1/saved-groups/local-beta-enrollment'
// USER_ID_TEST from playwright/util/constants.ts; synthetic only.
const enrolledLecturerId = '76047345-3801-4628-ae7b-adbebcfe8821'
const evaluationEnvironments = ['test', 'development']

process.env.GROWTHBOOK_API_HOST = 'https://growthbook.test'
process.env.GROWTHBOOK_CLIENT_KEY = 'sdk-test'
process.env.GROWTHBOOK_ENV = 'test'
// The enrollment service validates this control plane exactly like the real
// one: HTTPS origin without credentials, query, or hash. The fixture
// intercepts the requests in-process instead of serving a network endpoint.
process.env.GROWTHBOOK_MANAGEMENT_API_URL = 'https://growthbook.test'
process.env.GROWTHBOOK_MANAGEMENT_API_KEY = 'local-fixture-management-key'
process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID = 'local-beta-enrollment'
const expectedAuthorization = `Bearer ${process.env.GROWTHBOOK_MANAGEMENT_API_KEY}`

// Saved-group membership drives ai-beta so a real opt-in or opt-out changes
// the actual backend decision. The seeded lecturer starts enrolled because
// enabled-authoring runtime proof relies on that contract.
const savedGroupValues = new Set([enrolledLecturerId])

function featurePayload() {
  return {
    features: {
      'ai-beta': {
        defaultValue: false,
        rules: [
          {
            condition: {
              id: { $in: [...savedGroupValues] },
              actorType: 'user',
              catalyst: true,
              environment: { $in: evaluationEnvironments },
            },
            force: true,
          },
        ],
      },
      'beta-signup': {
        defaultValue: false,
        rules: [
          {
            condition: {
              id: enrolledLecturerId,
              actorType: 'user',
              catalyst: true,
              environment: { $in: evaluationEnvironments },
            },
            force: true,
          },
        ],
      },
    },
  }
}

function authorizationOf(request, init) {
  const headers = new Headers(
    init?.headers ?? (request instanceof Request ? request.headers : undefined)
  )
  return headers.get('authorization')
}

async function savedGroupResponse(request, init) {
  if (authorizationOf(request, init) !== expectedAuthorization) {
    return new Response(null, { status: 401 })
  }

  const declaredMethod =
    init?.method ?? (request instanceof Request ? request.method : undefined)
  const method = declaredMethod ?? 'GET'

  if (method === 'GET') {
    return Response.json({
      savedGroup: { type: 'list', values: [...savedGroupValues] },
    })
  }

  if (method === 'POST') {
    const raw =
      init?.body ??
      (request instanceof Request ? await request.text() : undefined)
    let values
    try {
      values = JSON.parse(String(raw)).values
    } catch {
      return new Response(null, { status: 400 })
    }
    const validValues =
      Array.isArray(values) &&
      values.every((value) => value === enrolledLecturerId)
    if (!validValues) {
      return new Response(null, { status: 400 })
    }

    savedGroupValues.clear()
    for (const value of values) savedGroupValues.add(value)
    return Response.json({
      savedGroup: { type: 'list', values: [...savedGroupValues] },
    })
  }

  return new Response(null, { status: 405 })
}

const originalFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url === fixtureUrl) {
    return Promise.resolve(Response.json(featurePayload()))
  }
  if (url === savedGroupUrl) {
    return savedGroupResponse(input, init)
  }
  return originalFetch(input, init)
}
