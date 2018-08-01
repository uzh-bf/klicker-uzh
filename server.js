require('dotenv').config()

const isProd = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV === 'development'
const hasRedis = !!process.env.REDIS_HOST

// prepare page configuration
const pages = [
  { url: '/' },
  { url: '/user/login' },
  { url: '/user/registration' },
  { url: '/questions/create' },
  {
    cached: 600,
    mapParams: req => ({ shortname: req.params.shortname }),
    renderPath: '/qr',
    url: '/qr/:shortname',
  },
  {
    mapParams: req => ({ public: true, sessionId: req.params.sessionId }),
    renderPath: '/sessions/evaluation',
    url: '/sessions/public/:sessionId',
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
    cached: 20,
    mapParams: req => ({ shortname: req.params.shortname }),
    renderPath: '/join',
    url: '/join/:shortname',
  },
]

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

function setupTransactionAPM(req) {
  // set the APM transaction name
  if (apm) {
    if (req.originalUrl.length > 6 && req.originalUrl.substring(0, 6) !== '/_next') {
      apm.setTransactionName(`${req.method} ${req.originalUrl}`)
    }

    // set the user context if a cookie was set
    if (req.cookies.userId) {
      apm.setUserContext({ id: req.cookies.userId })
    }
  }
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
const languages = glob.sync(`${APP_DIR}/lang/*.json`).map(f => basename(f, '.json'))

function getLocale(req) {
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
function getLocaleDataScript(locale) {
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
function getMessages(locale) {
  return require(`${APP_DIR}/lang/${locale}.json`)
}

function setupLocale(req, res) {
  const { locale = 'en', setCookie } = getLocale(req)

  req.locale = locale
  req.localeDataScript = getLocaleDataScript(locale)
  req.messages = isDev ? {} : getMessages(locale)

  // set a locale cookie with the specified language
  if (setCookie) {
    res.cookie('locale', locale)
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
    cache = new Redis({
      db: 0,
      family: 4,
      host: process.env.REDIS_HOST,
      password: process.env.REDIS_PASS,
      port: process.env.REDIS_PORT || 6379,
    })
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
    if (process.env.APP_PROXY) {
      server.enable('trust proxy')
      console.log('[klicker-react] Enabling trust proxy mode for IP pass-through')
    }

    // secure the server with helmet
    server.use(
      helmet({
        contentSecurityPolicy: isProd &&
          process.env.HELMET_CSP && {
            directives: {
              defaultSrc: ['self'],
              fontSrc: ['fonts.gstatic.com', 'cdnjs.cloudflare.com'],
              reportUri: process.env.HELMET_CSP_REPORT_URI,
              scriptSrc: ['cdn.polyfill.io'],
              styleSrc: ['maxcdn.bootstrapcdn.com', 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
            },
            reportOnly: true,
          },
        frameguard: isProd && !!process.env.HELMET_FRAMEGUARD,
        hsts: isProd &&
          process.env.HELMET_HSTS && {
            includeSubdomains: false,
            // maxAge: 31536000,
            // preload: true,
          },
      })
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

    // attach all prepared middlewares to the express instance
    server.use(...middleware)

    // create routes for all specified static and dynamic pages
    pages.forEach(({ url, mapParams, renderPath, cached = false }) => {
      server.get(url, (req, res) => {
        // setup locale and get messages for the specific route
        setupLocale(req, res)

        // inject transaction information for APM
        setupTransactionAPM(req)

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

      // inject transaction information for APM
      setupTransactionAPM(req)

      return handle(req, res)
    })

    server.listen(3000, err => {
      if (err) throw err
      console.log('[klicker-react] Ready on http://localhost:3000')
    })
  })
  .catch(err => {
    console.error(err.stack)
    process.exit(1)
  })

// perform cleanup for (forced) shutdown
function handleShutdown() {
  console.log('[klicker-react] Shutting down server...')

  if (hasRedis) {
    cache.disconnect()
    console.log('[redis] Disconnected')
  }

  console.log('[klicker-react] Shutdown complete')
  process.exit(0)
}
process.on('SIGINT', handleShutdown)
process.on('exit', handleShutdown)
process.once('SIGUSR2', handleShutdown)
