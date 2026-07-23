import { createServer } from 'node:http'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4010
const DEFAULT_ALLOWED_ORIGIN = 'http://127.0.0.1:3101'
const DEFAULT_GRAPHQL_PATH = '/graphql'

const host = process.env.HOST || DEFAULT_HOST
const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10)
const allowedOrigin = process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN
const graphqlPath = process.env.GRAPHQL_PATH || DEFAULT_GRAPHQL_PATH

const quizId = 'test-quiz'
const courseId = 'test-course'
const stackId = 101

function setCorsHeaders(req, res) {
  const origin = req.headers.origin

  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'content-type, authorization, x-graphql-yoga-csrf'
  )
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
}

function sendJson(req, res, statusCode, payload) {
  setCorsHeaders(req, res)
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

function sendText(req, res, statusCode, body) {
  setCorsHeaders(req, res)
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []

    req.on('data', (chunk) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })

    req.on('error', reject)
  })
}

function extractOperationName(body) {
  if (typeof body?.operationName === 'string') {
    return body.operationName
  }

  if (typeof body?.query !== 'string') {
    return null
  }

  const match = body.query.match(/\b(query|mutation)\s+(\w+)/)
  return match?.[2] ?? null
}

function extractGetRequestBody(url) {
  const operationName = url.searchParams.get('operationName')
  const rawVariables = url.searchParams.get('variables')

  return {
    operationName,
    variables: rawVariables ? JSON.parse(rawVariables) : {},
  }
}

function buildPracticeQuiz() {
  return {
    __typename: 'PracticeQuiz',
    id: quizId,
    status: 'PUBLISHED',
    name: 'Embedded quiz harness',
    displayName: 'Embedded quiz harness',
    description: null,
    pointsMultiplier: 1,
    resetTimeDays: 0,
    availableFrom: null,
    orderType: 'SEQUENTIAL',
    numOfStacks: 1,
    isOwner: false,
    course: {
      __typename: 'Course',
      id: courseId,
      displayName: 'Embed Harness Course',
      color: '#0ea5e9',
    },
    stacks: [
      {
        __typename: 'ElementStack',
        id: stackId,
        type: 'PRACTICE_QUIZ',
        displayName: 'Mock stack',
        description: null,
        order: 1,
        elements: [],
      },
    ],
  }
}

function buildStackFeedback() {
  return {
    __typename: 'StackFeedback',
    id: 'mock-feedback',
    status: 'correct',
    score: 1,
    evaluations: [],
  }
}

function handleOperation(req, res, operationName, body) {
  console.log(`Mock GraphQL operation: ${operationName ?? 'unknown'}`)

  switch (operationName) {
    case 'GetPracticeQuiz': {
      sendJson(req, res, 200, {
        data: {
          practiceQuiz: buildPracticeQuiz(),
        },
      })
      return
    }

    case 'RespondToElementStack': {
      const requestedStackId = body?.variables?.stackId

      if (requestedStackId !== stackId) {
        sendJson(req, res, 200, {
          errors: [
            {
              message: `Unexpected stackId ${requestedStackId}`,
            },
          ],
        })
        return
      }

      sendJson(req, res, 200, {
        data: {
          respondToElementStack: buildStackFeedback(),
        },
      })
      return
    }

    case 'Self': {
      sendJson(req, res, 200, {
        data: {
          self: null,
        },
      })
      return
    }

    case 'GetBookmarksPracticeQuiz': {
      sendJson(req, res, 200, {
        data: {
          getBookmarksPracticeQuiz: [],
        },
      })
      return
    }

    default: {
      sendJson(req, res, 200, {
        errors: [
          {
            message: `Unsupported operation: ${operationName ?? 'unknown'}`,
          },
        ],
      })
    }
  }
}

const server = createServer(async (req, res) => {
  const method = req.method ?? 'GET'
  const url = new URL(
    req.url ?? '/',
    `http://${req.headers.host ?? 'localhost'}`
  )

  console.log(`${method} ${url.pathname}${url.search}`)

  if (url.pathname === '/favicon.ico') {
    res.writeHead(204)
    res.end()
    return
  }

  if (method === 'OPTIONS') {
    setCorsHeaders(req, res)
    res.writeHead(204)
    res.end()
    return
  }

  if (method !== 'POST' && method !== 'GET') {
    sendText(req, res, 405, 'Method Not Allowed')
    return
  }

  if (url.pathname !== graphqlPath) {
    sendText(req, res, 404, 'Not Found')
    return
  }

  try {
    if (method === 'GET') {
      const body = extractGetRequestBody(url)
      handleOperation(req, res, body.operationName, body)
      return
    }

    const rawBody = await readBody(req)
    const body = rawBody ? JSON.parse(rawBody) : {}
    const operationName = extractOperationName(body)

    handleOperation(req, res, operationName, body)
  } catch (error) {
    console.error(error)
    sendJson(req, res, 500, {
      errors: [
        {
          message: 'Failed to handle mock GraphQL request.',
        },
      ],
    })
  }
})

server.listen(port, host, () => {
  console.log(
    `Embed harness mock GraphQL API running at http://${host}:${port}${graphqlPath}`
  )
  console.log(`Allowed browser origin: ${allowedOrigin}`)
})
