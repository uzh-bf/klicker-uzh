/* eslint-disable */

require('full-icu')
const IntlPolyfill = require('intl')
const glob = require('glob')
const cookieParser = require('cookie-parser')
const express = require('express')
const next = require('next')
const compression = require('compression')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const { basename } = require('path')
const { readFileSync } = require('fs')

// import the configuration
const CFG = require('./src/klicker.conf.js')

// log the configuration
console.log('[klicker-react] Successfully loaded configuration')
console.log(CFG.toString())

// validate the configuration
// fail early if anything is invalid
CFG.validate({ allowed: 'strict' })

const APP_CFG = CFG.get('app')
const CACHE_CFG = CFG.get('cache')
const S3_CFG = CFG.get('s3')
const SECURITY_CFG = CFG.get('security')
const SERVICES_CFG = CFG.get('services')

const isProd = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV === 'development'
const hasRedis = CACHE_CFG.redis.enabled

// prepare page configuration
const pages = [
  { cached: CACHE_CFG.pages.landing, url: '/' },
  { url: '/user/login' },
  { url: '/user/registration' },
  { url: '/questions/create' },
  {
    cached: CACHE_CFG.pages.qr,
    mapParams: (req) => ({ shortname: req.params.shortname }),
    renderPath: '/qr',
    url: '/qr/:shortname',
  },
  {
    mapParams: (req) => ({ public: true, sessionId: req.params.sessionId }),
    renderPath: '/sessions/evaluation',
    url: '/sessions/public/:sessionId',
  },
  {
    mapParams: (req) => ({ sessionId: req.params.sessionId }),
    renderPath: '/sessions/print',
    url: '/sessions/print/:sessionId',
  },
  {
    mapParams: (req) => ({ sessionId: req.params.sessionId }),
    renderPath: '/sessions/evaluation',
    url: '/sessions/evaluation/:sessionId',
  },
  {
    mapParams: (req) => ({ questionId: req.params.questionId }),
    renderPath: '/questions/details',
    url: '/questions/:questionId',
  },
  {
    mapParams: (req) => ({ questionId: req.params.questionId }),
    renderPath: '/questions/duplicate',
    url: '/questions/duplicate/:questionId',
  },
  {
    cached: CACHE_CFG.pages.join,
    mapParams: (req) => ({ shortname: req.params.shortname }),
    renderPath: '/join',
    url: '/join/:shortname',
  },
  {
    mapParams: (req) => ({ shortname: req.params.shortname, sessionId: req.params.sessionId }),
    renderPath: '/login',
    url: '/login/:shortname/:sessionId',
  },
]

// Polyfill Node with `Intl` that has data for all locales.
// See: https://formatjs.io/guides/runtime-environments/#server
Intl.NumberFormat = IntlPolyfill.NumberFormat
Intl.DateTimeFormat = IntlPolyfill.DateTimeFormat

// Bootstrap a new Next.js application
const app = next({ dev: isDev })
const handle = app.getRequestHandler()

// Get the supported languages by looking for translations in the `lang/` dir.
const languages = glob.sync(`./src/lang/*.json`).map((f) => basename(f, '.json'))

// We need to expose React Intl's locale data on the request for the user's
// locale. This function will also cache the scripts by lang in memory.
const localeDataCache = new Map()
function getLocaleDataScript(locale) {
  if (!localeDataCache.has(locale)) {
    const localeDataFile = require.resolve(`@formatjs/intl-relativetimeformat/dist/locale-data/${locale}`)
    const localeDataScript = readFileSync(localeDataFile, 'utf8')
    localeDataCache.set(locale, localeDataScript)
  }
  return localeDataCache.get(locale)
}

// We need to load and expose the translations on the request for the user's
// locale. These will only be used in production, in dev the `defaultMessage` in
// each message description in the source code will be used.
function getMessages(locale) {
  return require(`./src/lang/${locale}.json`)
}

function getLocale(req) {
  try {
    // if a locale cookie was already set, use the locale saved within
    if (req.cookies.locale && languages.includes(req.cookies.locale)) {
      return { locale: req.cookies.locale }
    }

    // if the accepts header is set, use its language
    const acceptedLang = req.acceptsLanguages(isDev ? ['en'] : languages) || 'en'
    return {
      locale: acceptedLang.includes('-') ? acceptedLang.split('-')[0] : acceptedLang,
      setCookie: true,
    }
  } catch (e) {
    console.error(e)
    return {
      locale: 'en',
      setCookie: true,
    }
  }
}

function setupLocale(req, res) {
  const { locale, setCookie } = getLocale(req)

  req.locale = locale
  // req.localeDataScript = getLocaleDataScript(locale)
  req.messages = isDev ? {} : getMessages(locale)

  // set a locale cookie with the specified language
  if (setCookie) {
    res.cookie('locale', locale, { secure: true })
  }
}

// prepare cache to be connected to
let cache
async function connectCache() {
  if (cache) {
    return cache
  }

  if (hasRedis) {
    const Redis = require('ioredis')
    const { db, host, password, port } = CACHE_CFG.redis
    cache = new Redis({ db, family: 4, host, password, port })

    console.log('[redis] Connected to redis (db0) for SSR caching')
  } else {
    const LRUCache = require('lru-cache')
    cache = new LRUCache({
      max: 100,
      // TODO: this would be nice to set much higher
      // but how would we clean up i.e. /join/someuser when the running session updates?
      maxAge: 1000 * 10, // pages are cached for 10 seconds
    })
    console.log('[lru-cache] Setup LRU-cache for SSR caching')
  }

  return cache
}

// construct a unique cache key from the request params
function getCacheKey(req) {
  return `${req.url}:${req.locale}`
}

// render a page to html and cache it in the appropriate place
async function renderAndCache(req, res, pagePath, queryParams, expiration = 60) {
  const key = getCacheKey(req)

  let cached
  if (hasRedis) {
    cached = await cache.get(key)
  } else {
    cached = cache.get(key)
  }

  // check if the page has already been cached
  // return the cached HTML if this is the case
  if (cached) {
    console.log(`[klicker-react] cache hit: ${key}`)

    res.setHeader('x-cache', 'HIT')
    res.send(cached)
    return
  }

  // otherwise server-render the page and cache/return it
  console.log(`[klicker-react] cache miss: ${key}`)
  try {
    // render the requested page to a html string
    const html = await app.renderToHTML(req, res, pagePath, queryParams)

    // return the response
    res.setHeader('x-cache', 'MISS')
    res.send(html)

    // if there was something wrong with the request
    // skip saving the page into cache
    if (res.statusCode !== 200) {
      return
    }

    // add the html string to the cache
    // if redis is used, let the cache expire
    if (hasRedis) {
      cache.set(key, html, 'EX', expiration)
    } else {
      cache.set(key, html)
    }
  } catch (e) {
    app.renderError(e, req, res, pagePath, queryParams)
  }
}

app
  .prepare()
  .then(() => {
    console.log('[klicker-react] Starting up...')

    // setup an express instance
    const server = express()

    // connect to the SSR cache
    connectCache()

    // if the server is behind a proxy, set the APP_PROXY env to true
    // this will make express trust the X-* proxy headers and set corresponding req.ip
    if (APP_CFG.trustProxy) {
      server.enable('trust proxy')
      console.log('[klicker-react] Enabling trust proxy mode for IP pass-through')
    }

    // secure the server with helmet
    if (isProd) {
      const { csp, expectCt, frameguard, hsts, referrerPolicy } = SECURITY_CFG
      const { googleAnalytics, slaask, logrocket } = SERVICES_CFG

      const optionalGoogleAnalytics = googleAnalytics.enabled ? ['www.google-analytics.com'] : []
      const optionalSlaask = slaask.enabled ? ['cdn.slaask.com', 'js.pusher.com', 'cdn.embedly.com'] : []
      const optionalLogrocket = logrocket.enabled ? ['cdn.logrocket.io'] : []

      server.use(
        helmet({
          contentSecurityPolicy: csp.enabled && {
            // TODO get rid of unsafe-inline by applying nonces to scripts and styles
            // generating nonces is currently not correctly supported by nextjs
            directives: {
              connectSrc: [...csp.connectSrc, ...optionalGoogleAnalytics],
              defaultSrc: csp.defaultSrc,
              fontSrc: csp.fontSrc,
              frameAncestors: frameguard.enabled && frameguard.ancestors,
              imgSrc: [...csp.imgSrc, S3_CFG.rootUrl, ...optionalSlaask, ...optionalGoogleAnalytics],
              reportUri: csp.reportUri,
              scriptSrc: [...csp.scriptSrc, ...optionalLogrocket, ...optionalSlaask, ...optionalGoogleAnalytics],
              styleSrc: [...csp.styleSrc, ...optionalSlaask, ...optionalGoogleAnalytics],
            },
            reportOnly: !csp.enforce,
          },
          expectCt: expectCt.enabled && {
            enforce: expectCt.enforce,
            maxAge: expectCt.maxAge,
            reportUri: expectCt.reportUri,
          },
          frameguard: frameguard.enabled,
          hsts: hsts.enabled && {
            includeSubdomains: hsts.includeSubdomains,
            maxAge: hsts.maxAge,
            preload: hsts.preload,
          },
          referrerPolicy,
        })
      )
    }

    let middleware = []

    // add CORS if defined
    if (SECURITY_CFG.cors.origin) {
      middleware.push(
        cors({
          credentials: SECURITY_CFG.cors.credentials,
          origin: SECURITY_CFG.cors.origin,
          optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
        })
      )
    }

    // enable cookie parsing for the locale cookie
    middleware.push(cookieParser())

    // add morgan logger
    if (process.env.NODE_ENV !== 'test') {
      middleware.push(morgan(isProd ? 'combined' : 'dev'))
    }

    if (isProd && APP_CFG.gzip) {
      // compress using gzip (only in production)
      middleware = [compression(), ...middleware]
    }

    // attach all prepared middlewares to the express instance
    server.use(...middleware)

    // create routes for all specified static and dynamic pages
    pages.forEach(({ url, mapParams, renderPath, cached = false }) => {
      server.get(url, (req, res) => {
        // setup locale and get messages for the specific route
        setupLocale(req, res)

        // if the route contents should be cached
        if (cached) {
          renderAndCache(req, res, renderPath || url, mapParams ? mapParams(req) : undefined, cached)
        } else {
          app.render(req, res, renderPath || url, mapParams ? mapParams(req) : undefined)
        }
      })
    })

    server.get('*', (req, res) => {
      // setup locale and get messages for the specific route
      setupLocale(req, res)

      return handle(req, res)
    })

    server.listen(3000, (err) => {
      if (err) throw err
      console.log('[klicker-react] Ready on http://localhost:3000')
    })
  })
  .catch((err) => {
    console.error(err.stack)
    process.exit(1)
  })

const shutdown = (signal) => async () => {
  console.log('[klicker-react] Shutting down server')

  if (hasRedis) {
    await cache.disconnect()
    console.log('[redis] Disconnected')
  }

  console.log('[klicker-react] Shutdown complete')
  process.kill(process.pid, signal)
}

const shutdownSignals = ['SIGINT', 'SIGUSR2', 'SIGTERM', 'exit']
shutdownSignals.forEach((signal) => process.once(signal, shutdown(signal)))
