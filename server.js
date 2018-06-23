require('dotenv').config()

const isProd = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV === 'development'

// initialize elastic-apm if so configured
let apm
if (process.env.APM_SERVER_URL) {
  apm = require('elastic-apm-node').start({
    active: !isDev,
    secretToken: process.env.APM_SECRET_TOKEN,
    serverUrl: process.env.APM_SERVER_URL,
    serviceName: process.env.APM_NAME,
  })
}

const IntlPolyfill = require('intl')

const { basename, join } = require('path')
const { readFileSync } = require('fs')
const glob = require('glob')

const accepts = require('accepts')
const cookieParser = require('cookie-parser')
const express = require('express')
const next = require('next')
const compression = require('compression')
const helmet = require('helmet')
const morgan = require('morgan')

// Polyfill Node with `Intl` that has data for all locales.
// See: https://formatjs.io/guides/runtime-environments/#server
Intl.NumberFormat = IntlPolyfill.NumberFormat
Intl.DateTimeFormat = IntlPolyfill.DateTimeFormat

// Specify where the Next.js source files are stored
const APP_DIR = './src'

// Bootstrap a new Next.js application
const app = next({ dev: isDev, dir: APP_DIR })
const handle = app.getRequestHandler()

// Get the supported languages by looking for translations in the `lang/` dir.
const languages = glob
  .sync(`${APP_DIR}/lang/*.json`)
  .map(f => basename(f, '.json'))

const getLocale = (req) => {
  // if a locale cookie was already set, use the locale saved within
  if (req.cookies.locale && languages.includes(req.cookies.locale)) {
    return {
      locale: req.cookies.locale,
    }
  }

  // if the accepts header is set, use its language
  const accept = accepts(req)
  return {
    locale: accept.language(isDev ? ['en'] : languages),
    setCookie: true,
  }
}

// We need to expose React Intl's locale data on the request for the user's
// locale. This function will also cache the scripts by lang in memory.
const localeDataCache = new Map()
const getLocaleDataScript = (locale) => {
  const lang = typeof locale === 'string' ? locale.split('-')[0] : 'en'
  if (!localeDataCache.has(lang)) {
    const localeDataFile = require.resolve(`react-intl/locale-data/${lang}`)
    const localeDataScript = readFileSync(localeDataFile, 'utf8')
    localeDataCache.set(lang, localeDataScript)
  }
  return localeDataCache.get(lang)
}

// We need to load and expose the translations on the request for the user's
// locale. These will only be used in production, in dev the `defaultMessage` in
// each message description in the source code will be used.
const getMessages = locale => require(`${APP_DIR}/lang/${locale}.json`)

// prepare cache to be connected to
let cache
const connectCache = async () => {
  if (cache) {
    return cache
  }

  if (process.env.REDIS_URL) {
    const Redis = require('ioredis')
    cache = new Redis(`redis://${process.env.REDIS_URL}`)
    console.log('[redis] Connected to db 0')
  } else {
    const LRUCache = require('lru-cache')
    cache = new LRUCache({
      max: 100,
      // TODO: this would be nice to set much higher
      // but how would we clean up i.e. /join/someuser when the running session updates?
      maxAge: 1000 * 10, // pages are cached for 10 seconds
    })
  }

  return cache
}

// construct a unique cache key from the request params
const getCacheKey = req => `${req.url}:${req.locale}`

// render a page to html and cache it in the appropriate place
const renderAndCache = async (
  req,
  res,
  pagePath,
  queryParams,
  expiration = 60,
) => {
  const key = getCacheKey(req)

  let cached
  if (process.env.REDIS_URL) {
    cached = await cache.get(key)
  } else {
    cached = cache.get(key)
  }

  // check if the page has already been cached
  // return the cached HTML if this is the case
  if (cached) {
    console.log(`[klicker-react] cache hit: ${key}`)

    res.send(cached)
    return
  }

  // otherwise server-render the page and cache/return it
  console.log(`[klicker-react] cache miss: ${key}`)
  try {
    const html = await app.renderToHTML(req, res, pagePath, queryParams)

    res.send(html)

    // let the cache expire if redis is used
    if (process.env.REDIS_URL) {
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
    const server = express()

    connectCache()

    // if the server is behind a proxy, set the APP_PROXY env to true
    // this will make express trust the X-* proxy headers and set corresponding req.ip
    if (process.env.APP_PROXY) {
      server.enable('trust proxy')
    }

    // secure the server with helmet
    server.use(
      helmet({
        contentSecurityPolicy:
          isProd && process.env.HELMET_CSP
            ? {
              directives: {
                defaultSrc: ["'self'"],
                fontSrc: ["'fonts.gstatic.com'", "'cdnjs.cloudflare.com'"],
                reportUri: process.env.HELMET_CSP_REPORT_URI,
                scriptSrc: ["'cdn.polyfill.io'"],
                styleSrc: [
                  "'maxcdn.bootstrapcdn.com'",
                  "'fonts.googleapis.com'",
                  "'cdnjs.cloudflare.com'",
                ],
              },
              reportOnly: true,
            }
            : false,
        frameguard: !!process.env.HELMET_FRAMEGUARD,
        hsts: !!process.env.HELMET_HSTS,
      }),
    )

    let middleware = [
      // enable cookie parsing for the locale cookie
      cookieParser(),
    ]

    // static file serving from public folder
    middleware.push(express.static(join(__dirname, 'public')))

    if (isProd) {
      // compress using gzip (only in production)
      middleware = [compression(), ...middleware]

      // activate morgan logging in production
      middleware.push(morgan('combined'))
    }

    server.use(...middleware)

    // prepare page configuration
    const pages = [
      {
        url: '/',
      },
      {
        url: '/user/login',
      },
      {
        url: '/user/registration',
      },
      {
        url: '/questions/create',
      },
      {
        cached: 600,
        mapParams: req => ({ shortname: req.params.shortname }),
        renderPath: '/qr',
        url: '/qr/:shortname',
      },
      {
        mapParams: req => ({ sessionId: req.params.sessionId }),
        renderPath: '/sessions/evaluation',
        url: '/sessions/evaluation/:sessionId',
      },
      {
        mapParams: req => ({ questionId: req.params.questionId }),
        renderPath: '/questions/details',
        url: '/questions/:questionId',
      },
      {
        cached: 30,
        mapParams: req => ({ shortname: req.params.shortname }),
        renderPath: '/join',
        url: '/join/:shortname',
      },
    ]

    // create routes for all specified static and dynamic pages
    pages.forEach(({
      url, mapParams, renderPath, cached = false,
    }) => {
      server.get(url, (req, res) => {
        // setup locale and get messages for the specific route
        const { locale, setCookie } = getLocale(req) || { locale: 'en' }

        req.locale = locale
        req.localeDataScript = getLocaleDataScript(locale)
        req.messages = isDev ? {} : getMessages(locale)

        // set a locale cookie with the specified language
        if (setCookie) {
          res.cookie('locale', locale)
        }

        // if the route contents should be cached
        if (cached) {
          renderAndCache(
            req,
            res,
            renderPath || url,
            mapParams ? mapParams(req) : undefined,
            cached,
          )
        } else {
          app.render(
            req,
            res,
            renderPath || url,
            mapParams ? mapParams(req) : undefined,
          )
        }
      })
    })

    server.get('*', (req, res) => {
      // setup locale and get messages for the specific route
      const { locale, setCookie } = getLocale(req)
      req.locale = locale
      req.localeDataScript = getLocaleDataScript(locale)
      req.messages = isDev ? {} : getMessages(locale)

      // set a locale cookie with the specified language
      if (setCookie) {
        res.cookie('locale', locale)
      }

      // set the APM transaction name
      if (apm) {
        if (
          req.originalUrl.length > 6
          && req.originalUrl.substring(0, 6) !== '/_next'
        ) {
          apm.setTransactionName(`${req.method} ${req.originalUrl}`)
        }

        // set the user context if a cookie was set
        if (req.cookies.userId) {
          apm.setUserContext({ id: req.cookies.userId })
        }
      }

      return handle(req, res)
    })

    server.listen(3000, (err) => {
      if (err) throw err

      // send a ready message to PM2
      if (process.send) {
        process.send('ready')
      }

      console.log('[klicker-react] Ready on http://localhost:3000')
    })
  })
  .catch((err) => {
    console.error(err.stack)
    process.exit(1)
  })

process.on('SIGINT', () => {
  console.log('[klicker-react] Shutting down server')

  if (process.env.REDIS_URL) {
    cache.disconnect()
  }

  console.log('[klicker-react] Shutdown complete')
  process.exit(0)
})

process.on('exit', () => {
  console.log('[klicker-react] Shutting down server')

  if (process.env.REDIS_URL) {
    cache.disconnect()
  }

  console.log('[klicker-react] Shutdown complete')
  process.exit(0)
})

process.once('SIGUSR2', () => {
  console.log('[klicker-react] Shutting down server')

  if (process.env.REDIS_URL) {
    cache.disconnect()
  }

  console.log('[klicker-react] Shutdown complete')
  process.exit(0)
})
