import { PrismaClient } from '@klicker-uzh/prisma'
import express, { Request, Response } from 'express'
import { validate as validateUUID } from 'uuid'

const app: express.Express = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3020

const API_NAME = 'olat-api'
const API_KEY = process.env.OLAT_API_KEY

enum StatusCode {
  SUCCESS = 200, // Request succeeded
  BAD_REQUEST = 400, // Malformed request (e.g. missing/invalid parameter, invalid header)
  UNAUTHORIZED = 401, // Invalid or missing API key
  NOT_FOUND = 404, // Resource not found (optional, e.g. courseID not found)
  UNSUPPORTED_MEDIA_TYPE = 415, // Wrong Content-Type header
}

async function apiKeyMiddleware(req: Request, res: Response, next: () => void) {
  const apiKey = req.headers['x-api-key']
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(StatusCode.BAD_REQUEST).json({ error: 'Missing API key' })
  }
  if (apiKey !== API_KEY) {
    return res
      .status(StatusCode.UNAUTHORIZED)
      .json({ error: 'Invalid API key' })
  }
  next()
}

app.use('/api', apiKeyMiddleware)
app.use(express.json())

app.get('/health', (req: Request, res: Response) => {
  res.status(StatusCode.SUCCESS).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  })
})

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'OLAT API server' })
})

function checkHeader(req: Request): StatusCode {
  const contentType = req.headers['content-type']
  if (contentType !== 'application/json') {
    return StatusCode.UNSUPPORTED_MEDIA_TYPE
  }

  const apiKey = req.headers['x-api-key']
  if (apiKey !== API_KEY) {
    return StatusCode.UNAUTHORIZED
  }

  return StatusCode.SUCCESS
}

async function getCourses(
  provider: string,
  providerAccountId: string
): Promise<any[] | null> {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: provider,
        providerAccountId: providerAccountId,
      },
    },
  })
  if (!account) return null

  const user = await prisma.user.findUnique({
    where: { id: account.userId },
    include: { courses: true },
  })
  const courses = user?.courses ?? []
  if (courses.length === 0) {
    return []
  }
  const coursesDetails = courses.map((course) => ({
    id: course.id,
    title: course.name,
  }))

  return coursesDetails
}

app.get('/api/configuration/courses', (req: Request, res: Response) => {
  const headerStatusCode = checkHeader(req)
  if (headerStatusCode !== StatusCode.SUCCESS) {
    return res
      .status(headerStatusCode)
      .json({ error: 'Invalid request headers' })
  }

  const provider = req.query.provider
  const identityMappingIdentifier = req.query.identityMappingIdentifier // TODO: maybe rename to providerAccountId
  if (!provider || typeof provider !== 'string') {
    return res
      .status(StatusCode.BAD_REQUEST)
      .json({ error: 'Missing provider' })
  } else if (
    !identityMappingIdentifier ||
    typeof identityMappingIdentifier !== 'string'
  ) {
    return res
      .status(StatusCode.BAD_REQUEST)
      .json({ error: 'Missing identityMappingIdentifier' })
  }

  getCourses(provider, identityMappingIdentifier).then((courses) => {
    if (courses === null) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ error: 'No account found' })
    } else if (courses.length === 0) {
      return res
        .status(StatusCode.NOT_FOUND)
        .json({ error: 'No courses found for this user' })
    }

    res.set('Content-Type', 'application/json')
    res.status(StatusCode.SUCCESS).json({
      courses: courses,
      timestamp: new Date().toISOString(),
      api: API_NAME,
    })
  })
})

async function getActivityTypes(courseId: string): Promise<any[] | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
    },
  })
  if (!course) return null

  const isGamificationEnabled = course.isGamificationEnabled
  const liveQuizzes = course.liveQuizzes ?? []
  const practiceQuizzes = course.liveQuizzes ?? []
  const microLearnings = course.liveQuizzes ?? []

  const activityTypes = [
    {
      id: 'LIVE_QUIZZES',
      title: `Live Quiz Overview (${liveQuizzes.length})`,
      path: '/liveQuizzes',
      subselectionNeeded: false,
      olatConfigurationKey: 'live-quizzes',
    },
    {
      id: 'PRACTICE_QUIZZES',
      title: `Practice Quiz Overview (${practiceQuizzes.length})`,
      path: '/practiceQuizzes',
      subselectionNeeded: false,
      olatConfigurationKey: 'practice-quizzes',
    },
    {
      id: 'MICRO_LEARNINGS',
      title: `Micro Learning Overview (${microLearnings.length})`,
      path: '/microLearnings',
      subselectionNeeded: false,
      olatConfigurationKey: 'micro-learnings',
    },
    {
      id: 'CREATE_ACCOUNT',
      title: 'Create Account',
      path: '/createAccount',
      subselectionNeeded: false,
      olatConfigurationKey: 'create-account',
    },
    {
      id: 'DOCS',
      title: 'Documentation',
      path: '/docs',
      subselectionNeeded: false,
      olatConfigurationKey: 'docs',
    },
    ...(liveQuizzes.length > 0
      ? [
          {
            id: 'LIVE_QUIZ',
            title: 'Live Quiz',
            path: '/liveQuiz',
            subselectionNeeded: true,
            olatConfigurationKey: 'live-quiz',
          },
        ]
      : []),
    ...(practiceQuizzes.length > 0
      ? [
          {
            id: 'PRACTICE_QUIZ',
            title: 'Practice Quiz',
            path: '/quiz',
            subselectionNeeded: true,
            olatConfigurationKey: 'quiz',
          },
        ]
      : []),
    ...(microLearnings.length > 0
      ? [
          {
            id: 'MICRO_LEARNING',
            title: 'Micro Learning',
            path: '/microLearning',
            subselectionNeeded: true,
            olatConfigurationKey: 'micro-learning',
          },
        ]
      : []),
    ...(isGamificationEnabled
      ? [
          {
            id: 'LEADERBOARD',
            title: `Leaderboard`,
            path: '/',
            subselectionNeeded: false,
            olatConfigurationKey: 'leaderboard',
          },
        ]
      : []),
  ]

  return activityTypes
}

app.get(
  '/api/configuration/course/:courseID/activityTypes',
  (req: Request, res: Response) => {
    const headerStatusCode = checkHeader(req)
    if (headerStatusCode !== StatusCode.SUCCESS) {
      return res
        .status(headerStatusCode)
        .json({ error: 'Invalid request headers' })
    }

    const courseID = req.params.courseID
    if (!courseID || typeof courseID !== 'string') {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'Missing courseID' })
    } else if (!validateUUID(courseID)) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'Invalid courseID' })
    }

    getActivityTypes(courseID).then((activityTypes) => {
      if (activityTypes === null) {
        return res
          .status(StatusCode.NOT_FOUND)
          .json({ error: 'Course not found' })
      }

      res.set('Content-Type', 'application/json')
      res.status(StatusCode.SUCCESS).json({
        activityTypes: activityTypes,
        timestamp: new Date().toISOString(),
        api: API_NAME,
      })
    })
  }
)

async function getActivities(
  courseID: string,
  activityTypeKey: string
): Promise<any[] | null> {
  if (['live-quiz', 'quiz', 'micro-learning'].indexOf(activityTypeKey) === -1) {
    return []
  }
  const activityMapping: Record<string, string> = {
    'live-quiz': 'liveQuizzes',
    quiz: 'practiceQuizzes',
    'micro-learning': 'microLearnings',
  }

  const relationKey = activityMapping[activityTypeKey]
  if (!relationKey) return []

  const includeObj: any = {}
  includeObj[relationKey] = true

  const course = await prisma.course.findUnique({
    where: { id: courseID },
    include: includeObj,
  })
  if (!course) return null

  const activities = course?.[relationKey] ?? []
  const activityDetails = activities.map((activity) => ({
    id: activity.id,
    title: activity.name,
  }))
  return activityDetails
}

app.get(
  '/api/configuration/course/:courseID/:activityTypeKey',
  (req: Request, res: Response) => {
    const headerStatusCode = checkHeader(req)
    if (headerStatusCode !== StatusCode.SUCCESS) {
      return res
        .status(headerStatusCode)
        .json({ error: 'Invalid request headers' })
    }

    const courseID = req.params.courseID
    if (!courseID || typeof courseID !== 'string' || !validateUUID(courseID)) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'courseID is required' })
    }
    const activityTypeKey = req.params.activityTypeKey
    if (!activityTypeKey || typeof activityTypeKey !== 'string') {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'activityTypeKey is required' })
    }

    if (
      [
        'live-quizzes',
        'practice-quizzes',
        'micro-learnings',
        'create-account',
        'docs',
        'live-quiz',
        'quiz',
        'micro-learning',
        'leaderboard',
      ].indexOf(activityTypeKey) === -1
    ) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'Invalid activityTypeKey' })
    }

    getActivities(courseID, activityTypeKey).then((activityTypes) => {
      if (activityTypes === null) {
        return res
          .status(StatusCode.NOT_FOUND)
          .json({ error: 'Course not found' })
      }

      res.set('Content-Type', 'application/json')
      res.status(StatusCode.SUCCESS).json({
        activityTypes: activityTypes,
        timestamp: new Date().toISOString(),
        api: API_NAME,
      })
    })
  }
)

app.listen(PORT, () => {
  console.log(`🚀 OLAT API server is running on port ${PORT}`)
  console.log(`📍 Health check: http://localhost:${PORT}/health`)
  console.log(`👋 Hello endpoint: http://localhost:${PORT}/hello`)
})

export default app
