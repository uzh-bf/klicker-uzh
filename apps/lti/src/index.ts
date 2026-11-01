import { COOKIE_NAMES, cookieName, signJWT } from '@klicker-uzh/util'
import {
  DefaultLogger,
  ExpressHttpHandler,
  IdTokenValidationMethod,
  type LaunchContext,
  Provider,
} from 'ltijs'
import { PostgresDatabaseManager } from './database.js'
import {
  appendJwt,
  getChatbotLaunchBinding,
  resolveLaunchTarget,
} from './launchTarget.js'
import {
  type PlatformRegistration,
  parsePlatform,
  resolvePlatforms,
} from './platforms.js'

// Validate required environment variables
if (!process.env.APP_ORIGIN_LTI) {
  console.error('APP_ORIGIN_LTI is required but not defined')
  process.exit(1)
}

const platforms = resolvePlatforms(process.env)

const database = new PostgresDatabaseManager(
  {
    host: process.env.LTI_DB_HOST,
    port: Number(process.env.LTI_DB_PORT ?? 5432),
    database: process.env.LTI_DB_NAME,
    user: process.env.LTI_DB_USER,
    password: process.env.LTI_DB_PASS,
    ssl: process.env.NODE_ENV !== 'development',
  },
  process.env.LTI_ENCRYPTION_KEY as string
)

const port = Number(process.env.LTI_PORT ?? 4000)

// No browser calls the LTI service cross-origin, so CORS stays off.
const httpHandler = new ExpressHttpHandler(new DefaultLogger(), {
  port,
  cors: false,
})

// ltijs 7 keeps the launch state in the browser's localStorage instead of
// cookies, so launches inside an LMS iframe also work when the browser blocks
// third-party cookies. The routes keep the paths the platforms are registered
// with.
const provider = new Provider({
  databaseManager: database,
  httpHandler,
  routes: { loginRoute: '/login', launchRoute: '/', keysetRoute: '/keys' },
})

// ltijs 7 responses cannot set cookies or headers, so the launch continues on
// a same-origin handoff route that issues the KlickerUZH token.
provider.onConnect(async (context, request, response) => {
  const launchTarget = resolveLaunchTarget(toLaunchToken(context), {
    query: request.query,
  })

  if (!launchTarget.ok) {
    console.error(
      `event=lti_launch_rejected targetSource=${launchTarget.source ?? 'null'} reason=${launchTarget.reason} rawType=${getRawType(launchTarget.rawValue)}`
    )
    return response.status(400).json({
      error: 'invalid_launch_target',
      reason: launchTarget.reason,
      source: launchTarget.source,
    })
  }

  const query: Record<string, string> = {}
  if (launchTarget.source === 'query') {
    query.redirectTo = launchTarget.target.href
  }
  context.redirect(response, '/handoff', { query })
})

httpHandler.app.get('/handoff', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')

  let context: LaunchContext
  try {
    context = await provider.getLaunchContext(String(req.query.ltik))
  } catch {
    // also the path of a reused handoff URL, whose launch is already deleted
    console.error('event=lti_handoff_rejected reason=unknown_or_used_launch')
    return res.status(401).json({ error: 'invalid_launch' })
  }

  // A launch issues one KlickerUZH token; a replayed handoff URL is rejected.
  // The launch is used up before its target is checked again, so a tampered
  // redirectTo cannot be retried with another target.
  let consumed: boolean
  try {
    consumed = await database.consumeIdToken(context.rawIdToken.id)
  } catch (error) {
    console.error(
      `event=lti_handoff_failed message=${error instanceof Error ? error.message : String(error)}`
    )
    return res.status(500).json({ error: 'handoff_failed' })
  }
  if (!consumed) {
    console.error('event=lti_handoff_rejected reason=used_or_expired_launch')
    return res.status(401).json({ error: 'invalid_launch' })
  }

  const launchTarget = resolveLaunchTarget(toLaunchToken(context), {
    query: req.query as Record<string, unknown>,
  })
  if (!launchTarget.ok) {
    console.error(
      `event=lti_handoff_rejected reason=${launchTarget.reason} targetSource=${launchTarget.source ?? 'null'}`
    )
    return res.status(400).json({
      error: 'invalid_launch_target',
      reason: launchTarget.reason,
      source: launchTarget.source,
    })
  }

  const jwt = await signJWT(
    {
      sub: context.idToken.user.id,
      email: context.idToken.user.email,
      scope: 'LTI1.3',
      chatbotLaunch: getChatbotLaunchBinding(launchTarget.target),
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '5m',
      issuer: process.env.APP_ORIGIN_LTI,
    }
  )

  res.cookie(cookieName(COOKIE_NAMES.LTI_TOKEN), jwt, {
    maxAge: 5 * 60 * 1000,
    path: '/',
    secure: true,
    sameSite: 'none',
    domain: process.env.COOKIE_DOMAIN as string,
  })

  const redirectUrl = appendJwt(launchTarget.target, jwt)
  console.log(
    `event=lti_launch_redirect targetSource=${launchTarget.source} targetHost=${launchTarget.target.hostname}`
  )

  return res.redirect(redirectUrl)
})

// Registers each configured platform once and keeps its stored keys, so the
// public keyset the platform knows stays valid across restarts.
const setup = async () => {
  // ltijs's startup banner reports its default port, not the handler's
  await provider.listen({ silent: true })
  console.log(`LTI service listening on port ${port}`)

  // Platforms that only ltijs 5 still knew keep working after the upgrade. The
  // configuration wins when both list the same platform.
  const configured = new Set(
    platforms.map((p) => JSON.stringify([p.url, p.clientId]))
  )
  const legacy: PlatformRegistration[] = []
  for (const row of await database.getLegacyPlatforms()) {
    let platform: PlatformRegistration
    try {
      platform = parsePlatform(row, process.env, 'from ltijs 5')
    } catch {
      console.error('event=lti_legacy_platform_skipped reason=invalid')
      continue
    }
    if (!configured.has(JSON.stringify([platform.url, platform.clientId]))) {
      legacy.push(platform)
    }
  }

  for (const registration of [...platforms, ...legacy]) {
    const fields = {
      name: registration.name,
      authenticationEndpoint: registration.authenticationEndpoint,
      accessTokenEndpoint: registration.accesstokenEndpoint,
      idTokenValidation: {
        method: IdTokenValidationMethod.JwkSet,
        key: registration.authConfig.key,
      },
    }
    const existing = await provider.platformManager.getPlatformByUrlAndClientId(
      registration.url,
      registration.clientId
    )
    if (existing) {
      await provider.platformManager.updatePlatform(existing, fields)
      continue
    }
    try {
      await provider.platformManager.registerPlatform({
        url: registration.url,
        clientId: registration.clientId,
        ...fields,
      })
    } catch (error) {
      // another replica registered the platform since the lookup above
      const registered =
        await provider.platformManager.getPlatformByUrlAndClientId(
          registration.url,
          registration.clientId
        )
      if (!registered) throw error
      await provider.platformManager.updatePlatform(registered, fields)
    }
  }
  console.log(
    `Registered ${platforms.length} configured and ${legacy.length} ltijs 5 LTI platforms`
  )
}

setup().catch((error: unknown) => {
  console.error(
    `LTI platform initialization failed: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
})

// The launch-target helpers read the ltijs 5 token shape.
function toLaunchToken(context: LaunchContext) {
  return {
    user: context.idToken.user.id,
    platformContext: { custom: context.idToken.launch.custom },
  }
}

function getRawType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}
