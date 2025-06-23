import { PrismaClient } from '@klicker-uzh/prisma'
import express, { Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import fs from 'fs/promises'
import path from 'path'
import { pick } from 'remeda'
import { fileURLToPath } from 'url'
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
  UNSUPPORTED_MEDIA_TYPE = 415,
  INTERNAL_SERVER_ERROR = 500,
}

interface ActivityType {
  id: string
  title: string
  path: string
  olatConfigurationKey: string
  isSubselectionRequired: boolean
  isEmailTransferRequired: boolean
}

interface ActivityTypeOfCourse {
  id: string
  title: string
  olatConfigurationKey: string
  isSubselectionRequired: boolean
}

let activityTypesAvailable: ActivityType[] = []
const activityKeysSubselection: string[] = [
  'live-quiz',
  'practice-quiz',
  'micro-learning',
] as const // NOTE: add more if required
let activityKeysGeneral: string[] = []
type ActivityTypeSubselection = (typeof activityKeysSubselection)[number]

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

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: 'Too many requests, please try again later.',
  },
})

app.use(limiter)
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
  if (!contentType || typeof contentType !== 'string') {
    return StatusCode.BAD_REQUEST
  }
  if (contentType !== 'application/json') {
    return StatusCode.UNSUPPORTED_MEDIA_TYPE
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
    include: {
      user: {
        include: {
          courses: true,
        },
      },
    },
  })

  const courses = account?.user?.courses ?? []
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
  const providerAccountId = req.query.providerAccountId
  if (!provider || typeof provider !== 'string') {
    return res
      .status(StatusCode.BAD_REQUEST)
      .json({ error: 'Missing provider' })
  } else if (!providerAccountId || typeof providerAccountId !== 'string') {
    return res
      .status(StatusCode.BAD_REQUEST)
      .json({ error: 'Missing providerAccountId' })
  }

  getCourses(provider, providerAccountId)
    .then((courses) => {
      if (courses?.length === 0) {
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
    .catch((error) => {
      console.error('Error fetching courses:', error)
      res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ error: 'Internal server error' })
    })
})

async function getActivityTypes(): Promise<any[] | null> {
  // filter out fields
  return activityTypesAvailable.map((activityType) => ({
    ...pick(activityType, [
      'id',
      'path',
      'olatConfigurationKey',
      'isEmailTransferRequired',
    ]),
  }))
}

app.get('/api/configuration/activityTypes', (req: Request, res: Response) => {
  const headerStatusCode = checkHeader(req)
  if (headerStatusCode !== StatusCode.SUCCESS) {
    return res
      .status(headerStatusCode)
      .json({ error: 'Invalid request headers' })
  }

  getActivityTypes().then((activityTypes) => {
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
})

async function getCourseActivityTypes(courseId: string): Promise<any[] | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      // NOTE: modify if required
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
    },
  })
  if (!course) return null

  const isGamificationEnabled = course.isGamificationEnabled
  const liveQuizzes = course.liveQuizzes ?? []
  const practiceQuizzes = course.practiceQuizzes ?? []
  const microLearnings = course.microLearnings ?? []

  const mapOverview: Record<string, any[]> = {
    // NOTE: modify if required
    'live-quizzes': liveQuizzes,
    'practice-quizzes': practiceQuizzes,
    'micro-learnings': microLearnings,
  }

  const mapSubselection: Record<string, any[]> = {
    // NOTE: modify if required
    'live-quiz': liveQuizzes,
    quiz: practiceQuizzes,
    'micro-learning': microLearnings,
  }
  const activityKeysGamification = ['course-leaderboard'] // NOTE: modify if required

  const activityTypes: ActivityTypeOfCourse[] = activityTypesAvailable.reduce(
    (
      accumulator: ActivityTypeOfCourse[],
      { id, title, olatConfigurationKey, isSubselectionRequired }
    ) => {
      if (olatConfigurationKey in mapOverview) {
        const count = mapOverview[olatConfigurationKey]?.length || 0
        accumulator.push({
          id,
          title: title + ` (${count})`,
          olatConfigurationKey,
          isSubselectionRequired,
        })
      } else if (olatConfigurationKey in mapSubselection) {
        const count = mapSubselection[olatConfigurationKey]?.length || 0
        if (count > 0) {
          accumulator.push({
            id,
            title,
            olatConfigurationKey,
            isSubselectionRequired,
          })
        }
      } else if (activityKeysGamification.includes(olatConfigurationKey)) {
        if (isGamificationEnabled) {
          accumulator.push({
            id,
            title,
            olatConfigurationKey,
            isSubselectionRequired,
          })
        }
      } else {
        accumulator.push({
          id,
          title,
          olatConfigurationKey,
          isSubselectionRequired,
        })
      }
      return accumulator
    },
    []
  )

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
        .json({ error: 'Missing courseID' }) // should not happen
    } else if (!validateUUID(courseID)) {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'Invalid courseID' })
    }

    getCourseActivityTypes(courseID).then((activityTypes) => {
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
  activityTypeKey: ActivityTypeSubselection // NOTE: modify if required
): Promise<any[] | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseID },
    include: {
      // NOTE: modify if required
      liveQuizzes: activityTypeKey === 'live-quiz',
      practiceQuizzes: activityTypeKey === 'practice-quiz',
      microLearnings: activityTypeKey === 'micro-learning',
    },
  })
  if (!course) return null

  const activityDetails = (
    course.liveQuizzes ??
    course.practiceQuizzes ??
    course.microLearnings
  ) // NOTE: modify if required
    .map((activity) => ({
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
        .json({ error: 'Invalid courseID' })
    }
    const activityTypeKey = req.params.activityTypeKey
    if (!activityTypeKey || typeof activityTypeKey !== 'string') {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'Missing activityTypeKey' }) // should not happen
    }
    if (
      activityKeysSubselection.indexOf(activityTypeKey) !== -1 &&
      validateUUID(courseID)
    ) {
      getActivities(courseID, activityTypeKey as ActivityTypeSubselection).then(
        (activityTypes) => {
          if (activityTypes === null) {
            return res
              .status(StatusCode.NOT_FOUND)
              .json({ error: 'Course not found' })
          }

          res.set('Content-Type', 'application/json')
          return res.status(StatusCode.SUCCESS).json({
            activityTypes: activityTypes,
            timestamp: new Date().toISOString(),
            api: API_NAME,
          })
        }
      )
    } else if (activityKeysGeneral.indexOf(activityTypeKey) !== -1) {
      return res.status(StatusCode.SUCCESS).json({
        activityTypes: [],
        timestamp: new Date().toISOString(),
        api: API_NAME,
      })
    } else {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'Invalid activityTypeKey' })
    }
  }
)

async function readData() {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const dataPath = path.join(__dirname, '../static/activityTypes.json')
    const data = await fs.readFile(dataPath, 'utf-8')
    activityTypesAvailable = JSON.parse(data)
    activityKeysGeneral = activityTypesAvailable
      .map((activityType) => activityType.olatConfigurationKey)
      .filter((key) => !activityKeysSubselection.includes(key))
  } catch (error) {
    console.error('Error reading data:', error)
    process.exit(1)
  }
}

readData().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 OLAT API server is running on port ${PORT}`)
    console.log(`📍 Health check: http://localhost:${PORT}/health`)
  })
})

export { StatusCode }
export default app
