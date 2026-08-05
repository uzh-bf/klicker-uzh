import { apiReference } from '@scalar/express-api-reference'
import { toSafeError } from '@klicker-uzh/logging/node'
import express, { Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { validate as validateUUID } from 'uuid'
import { logger } from './logger.js'
import {
  createRequestLoggingMiddleware,
  requestLogger,
} from './requestLogging.js'
import {
  getActivities,
  getActivityTypes,
  getCourseActivityTypes,
  getCourses,
} from './services.js'
import {
  AccountParameters,
  ActivityOlatConfigurationKey,
  activityOlatConfigurationKeys,
  ActivityTypeKeyParameters,
  CourseParameters,
  ErrorParameters,
  StatusCode,
} from './types.js'

const app: express.Express = express()
const PORT = process.env.NODE_ENV === 'development' ? 3030 : 3000

const API_KEY = process.env.OLAT_API_KEY
if (!API_KEY) {
  logger.fatal(
    {
      event: 'service.configuration_invalid',
      err: toSafeError('OLAT_API_KEY is required'),
    },
    'OLAT API configuration is invalid'
  )
  process.exit(1)
}

function logRequestFailure(req: Request, res: Response, message: string) {
  const log = requestLogger(res) ?? logger
  log.error(
    {
      event: 'http.request.failed',
      http: {
        method: req.method,
        route: res.locals.logRoute ?? 'unmatched',
        statusCode: StatusCode.INTERNAL_SERVER_ERROR,
        ...(typeof res.locals.logStartedAt === 'number'
          ? {
              durationMs: Math.round(
                performance.now() - res.locals.logStartedAt
              ),
            }
          : {}),
      },
      outcome: 'failure',
      err: toSafeError(message),
    },
    message
  )
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
  const contentType = req.headers['content-type']
  if (
    contentType &&
    typeof contentType === 'string' &&
    contentType !== 'application/json'
  ) {
    return res
      .status(StatusCode.UNSUPPORTED_MEDIA_TYPE)
      .json({ error: 'Unsupported content type' })
  }
  next()
}

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  statusCode: StatusCode.TOO_MANY_REQUESTS,
  message: {
    error: 'Too many requests, please try again later',
  },
})

app.use(createRequestLoggingMiddleware(logger))
app.use(limiter)
app.use('/api', apiKeyMiddleware)
app.use(express.json())

app.get('/health', (req: Request, res: Response) => {
  res.status(StatusCode.SUCCESS).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  })
})

// Serve OpenAPI specification
app.get('/openapi.yaml', async (req: Request, res: Response) => {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const specPath = path.join(__dirname, '../static/openapi.yaml')
    const yamlContent = await fs.readFile(specPath, 'utf-8')
    res.set('Content-Type', 'application/yaml')
    res.send(yamlContent)
  } catch {
    const log = requestLogger(res) ?? logger
    log.error(
      {
        event: 'dependency.read_failed',
        dependency: 'openapi_specification',
        err: toSafeError('Failed to read OpenAPI specification'),
      },
      'Failed to read OpenAPI specification'
    )
    logRequestFailure(req, res, 'Failed to serve OpenAPI specification')
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to load OpenAPI specification',
    })
  }
})

// Serve Scalar API documentation
app.use(
  '/api-docs',
  apiReference({
    url: '/openapi.yaml',
    theme: 'default',
  })
)

function getAccountParameters(
  req: Request
): AccountParameters | ErrorParameters {
  const providerAccountId = req.body.identityMappingIdentifier
  if (!providerAccountId || typeof providerAccountId !== 'string') {
    return {
      error: 'Missing providerAccountId',
      status: StatusCode.BAD_REQUEST,
    }
  }

  const provider = providerAccountId.split('@')[1]?.split('.')[0]
  if (!provider || typeof provider !== 'string') {
    return {
      error: 'Extraction of provider from providerAccountId failed',
      status: StatusCode.BAD_REQUEST,
    }
  }

  return {
    provider: provider,
    providerAccountId: providerAccountId,
  }
}

function getCourseParameters(req: Request): CourseParameters | ErrorParameters {
  const courseID = req.params.courseID
  if (!courseID || typeof courseID !== 'string') {
    return {
      error: 'Missing courseID',
      status: StatusCode.BAD_REQUEST,
    }
  } else if (!validateUUID(courseID)) {
    return {
      error: 'Invalid courseID',
      status: StatusCode.BAD_REQUEST,
    }
  }

  return {
    courseID: courseID,
  }
}

function getActivityTypeKeyParameters(
  req: Request
): ActivityTypeKeyParameters | ErrorParameters {
  const activityTypeKey = req.params.activityTypeKey
  if (!activityTypeKey || typeof activityTypeKey !== 'string') {
    return {
      error: 'Missing activityTypeKey',
      status: StatusCode.BAD_REQUEST,
    }
  } else if (
    !activityOlatConfigurationKeys.includes(
      activityTypeKey as ActivityOlatConfigurationKey
    )
  ) {
    return {
      error: 'Invalid activityTypeKey',
      status: StatusCode.BAD_REQUEST,
    }
  }

  return {
    activityTypeKey: activityTypeKey as ActivityOlatConfigurationKey,
  }
}

app.post('/api/configuration/courses', (req: Request, res: Response) => {
  const accountParameters = getAccountParameters(req)
  if ('error' in accountParameters) {
    return res
      .status(accountParameters.status)
      .json({ error: accountParameters.error })
  }
  const { provider, providerAccountId } = accountParameters

  getCourses(provider, providerAccountId)
    .then((courses) => {
      if (courses?.length === 0) {
        return res
          .status(StatusCode.NOT_FOUND)
          .json({ error: 'No courses found for this user' })
      }

      res.set('Content-Type', 'application/json')
      return res.status(StatusCode.SUCCESS).json({
        courses,
        timestamp: new Date().toISOString(),
      })
    })
    .catch(() => {
      logRequestFailure(req, res, 'Failed to fetch courses')
      return res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ error: 'Internal server error' })
    })
})

app.get('/api/configuration/activityTypes', (req: Request, res: Response) => {
  getActivityTypes(requestLogger(res))
    .then((activityTypes) => {
      res.set('Content-Type', 'application/json')
      return res.status(StatusCode.SUCCESS).json({
        activityTypes,
        timestamp: new Date().toISOString(),
      })
    })
    .catch(() => {
      logRequestFailure(req, res, 'Failed to fetch activity types')
      return res
        .status(StatusCode.INTERNAL_SERVER_ERROR)
        .json({ error: 'Internal server error' })
    })
})

app.post(
  '/api/configuration/course/:courseID/activityTypes',
  (req: Request, res: Response) => {
    const accountParameters = getAccountParameters(req)
    const courseParameters = getCourseParameters(req)

    const parameters = [accountParameters, courseParameters]
    for (const parameter of parameters) {
      if ('error' in parameter) {
        return res.status(parameter.status).json({ error: parameter.error })
      }
    }

    const { provider, providerAccountId } =
      accountParameters as AccountParameters
    const { courseID } = courseParameters as CourseParameters

    getCourseActivityTypes(
      provider,
      providerAccountId,
      courseID,
      requestLogger(res)
    )
      .then((activityTypes) => {
        if (activityTypes === null) {
          return res
            .status(StatusCode.NOT_FOUND)
            .json({ error: 'Course or account not found' })
        }

        res.set('Content-Type', 'application/json')
        return res.status(StatusCode.SUCCESS).json({
          activityTypes,
          timestamp: new Date().toISOString(),
        })
      })
      .catch(() => {
        logRequestFailure(req, res, 'Failed to fetch course activity types')
        return res
          .status(StatusCode.INTERNAL_SERVER_ERROR)
          .json({ error: 'Internal server error' })
      })
  }
)

app.post(
  '/api/configuration/course/:courseID/:activityTypeKey',
  (req: Request, res: Response) => {
    const accountParameters = getAccountParameters(req)
    const courseParameters = getCourseParameters(req)
    const activityTypeKeyParameters = getActivityTypeKeyParameters(req)

    const parameters = [
      accountParameters,
      courseParameters,
      activityTypeKeyParameters,
    ]
    for (const parameter of parameters) {
      if ('error' in parameter) {
        return res.status(parameter.status).json({ error: parameter.error })
      }
    }

    const { provider, providerAccountId } =
      accountParameters as AccountParameters
    const { courseID } = courseParameters as CourseParameters
    const { activityTypeKey } =
      activityTypeKeyParameters as ActivityTypeKeyParameters

    if (activityOlatConfigurationKeys.indexOf(activityTypeKey) !== -1) {
      getActivities(provider, providerAccountId, courseID, activityTypeKey)
        .then((activities) => {
          if (activities === null) {
            return res
              .status(StatusCode.NOT_FOUND)
              .json({ error: 'Course or account not found' })
          }

          res.set('Content-Type', 'application/json')
          return res.status(StatusCode.SUCCESS).json({
            activities,
            timestamp: new Date().toISOString(),
          })
        })
        .catch(() => {
          logRequestFailure(req, res, 'Failed to fetch course activities')
          return res
            .status(StatusCode.INTERNAL_SERVER_ERROR)
            .json({ error: 'Internal server error' })
        })
    } else {
      return res
        .status(StatusCode.BAD_REQUEST)
        .json({ error: 'Invalid activityTypeKey' })
    }
  }
)

app.listen(PORT, () => {
  logger.info(
    { event: 'service.started', port: PORT },
    'OLAT API service started'
  )
})

export { StatusCode }
export default app
