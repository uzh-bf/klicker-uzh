import { toSafeError } from '@klicker-uzh/logging/node'
import { signJWT } from '@klicker-uzh/util'
import { Provider } from 'ltijs'
// @ts-ignore
import Database from 'ltijs-sequelize'
import { appendJwt, resolveLaunchTarget } from './launchTarget.js'
import { logger } from './logger.js'

// Validate required environment variables
if (!process.env.APP_ORIGIN_LTI) {
  logger.fatal(
    {
      event: 'service.configuration_invalid',
      err: toSafeError('APP_ORIGIN_LTI is required'),
    },
    'LTI service configuration is invalid'
  )
  process.exit(1)
}

const PROVIDER_OPTIONS = {
  appRoute: '/',
  loginRoute: '/login',
  cookies: {
    secure: true,
    sameSite: 'none',
  },
  devMode: process.env.LTI_DEV_MODE === 'true',
  ltiaas: process.env.LTI_AAS_MODE === 'true',
}

// Initialize database connection
if (process.env.LTI_DB_TYPE === 'postgres') {
  const db = new Database(
    process.env.LTI_DB_NAME,
    process.env.LTI_DB_USER,
    process.env.LTI_DB_PASS,
    {
      // see https://sequelize.org/api/v6/class/src/sequelize.js~sequelize#instance-constructor-constructor
      host: process.env.LTI_DB_HOST,
      port: process.env.LTI_DB_PORT ?? 5432,
      dialect: 'postgres',
      dialectOptions: {
        ssl: process.env.NODE_ENV !== 'development',
      },
    }
  )

  // Setup LTI provider
  Provider.setup(
    process.env.LTI_ENCRYPTION_KEY as string,
    {
      plugin: db,
    },
    PROVIDER_OPTIONS
  )
} else {
  // Setup LTI provider
  Provider.setup(
    process.env.LTI_ENCRYPTION_KEY as string,
    {
      url: process.env.LTI_DB_CONNECTION_STRING as string,
    },
    PROVIDER_OPTIONS
  )
}

// LTI launch callback (token has been verified by ltijs beforehand)
// @ts-ignore The type here is wrong, a Promise is accepted as per official docs
Provider.onConnect(async (token, req, res) => {
  logger.info(
    { event: 'lti.launch.accepted', outcome: 'verified' },
    'Accepted verified LTI launch'
  )

  if (!process.env.APP_ORIGIN_LTI) {
    logger.fatal(
      {
        event: 'service.configuration_invalid',
        err: toSafeError('APP_ORIGIN_LTI is required'),
      },
      'LTI service configuration is invalid'
    )
    process.exit(1)
  }

  const jwt = await signJWT(
    {
      sub: token.user,
      email: token.userInfo.email,
      scope: 'LTI1.3',
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '5m',
      issuer: process.env.APP_ORIGIN_LTI,
    }
  )

  res.cookie('lti-token', jwt, {
    secure: true,
    sameSite: 'none',
    domain: process.env.COOKIE_DOMAIN as string,
  })

  const launchTarget = resolveLaunchTarget(token, {
    query: req.query as Record<string, unknown>,
  })

  if (!launchTarget.ok) {
    logger.warn(
      {
        event: 'lti.launch.rejected',
        outcome: 'invalid_target',
        targetSource: launchTarget.source ?? 'none',
        reason: launchTarget.reason,
        rawType: getRawType(launchTarget.rawValue),
      },
      'Rejected LTI launch target'
    )

    // remove lti token to avoid issues caused by this cookie
    res.clearCookie('lti-token', {
      secure: true,
      sameSite: 'none',
      domain: process.env.COOKIE_DOMAIN as string,
    })

    return res.status(400).json({
      error: 'invalid_launch_target',
      reason: launchTarget.reason,
      source: launchTarget.source,
    })
  }

  const redirectUrl = appendJwt(launchTarget.target, jwt)
  logger.info(
    {
      event: 'lti.redirect.selected',
      outcome: 'success',
      targetSource: launchTarget.source,
    },
    'Redirected verified LTI launch'
  )

  return res.redirect(redirectUrl)
})

// setup function
const setup = async () => {
  await Provider.deploy({
    port: Number(process.env.LTI_PORT) ?? 4000,
  })
  logger.info({ event: 'service.started' }, 'LTI service started')

  // Optional: Register platform if you're setting this up for the first time
  const platform = await Provider.registerPlatform({
    url: process.env.LTI_URL as string,
    name: process.env.LTI_NAME as string,
    clientId: process.env.LTI_CLIENT_ID as string,
    authenticationEndpoint: process.env.LTI_AUTH_ENDPOINT as string,
    accesstokenEndpoint: process.env.LTI_TOKEN_ENDPOINT as string,
    authConfig: {
      method: 'JWK_SET',
      key: process.env.LTI_KEYS_ENDPOINT as string,
    },
  })

  if (!platform) {
    throw new Error('Failed to register platform')
  }

  await platform.platformPublicKey()
  logger.info(
    { event: 'lti.platform.registered', outcome: 'success' },
    'Registered LTI platform'
  )
}

// Get user and context information
Provider.app.get('/info', async (req, res) => {
  const token = res.locals.token

  const info: {
    name?: string
    given_name?: string
    family_name?: string
    email?: string
    user?: string
  } = {}
  if (token.userInfo) {
    if (token.userInfo.name) info.name = token.userInfo.name
    if (token.userInfo.given_name) info.given_name = token.userInfo.given_name
    if (token.userInfo.family_name)
      info.family_name = token.userInfo.family_name
    if (token.userInfo.email) info.email = token.userInfo.email
  }

  if (token.user) info.user = token.user

  return res.send(info)
})

setup().catch(() => {
  logger.fatal(
    {
      event: 'service.start_failed',
      err: toSafeError('Failed to start LTI service'),
    },
    'Failed to start LTI service'
  )
})

function getRawType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}
