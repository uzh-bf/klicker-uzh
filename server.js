require('dotenv').config()

const IntlPolyfill = require('intl')

const { basename, join } = require('path')
const { readFileSync } = require('fs')
const glob = require('glob')

const accepts = require('accepts')
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
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev, dir: APP_DIR })
const handle = app.getRequestHandler()

// Get the supported languages by looking for translations in the `lang/` dir.
const languages = glob.sync(`${APP_DIR}/lang/*.json`).map(f => basename(f, '.json'))

// We need to expose React Intl's locale data on the request for the user's
// locale. This function will also cache the scripts by lang in memory.
const localeDataCache = new Map()
const getLocaleDataScript = (locale) => {
  const lang = locale.split('-')[0]
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
    cache = Redis(`redis://${process.env.REDIS_URL}`)
  } else {
    const LRUCache = 'lru-cache'
    cache = new LRUCache({
      max: 100,
      maxAge: 1000 * 60 * 60,
    })
  }

  return cache
}

// construct a unique cache key from the request params
const getCacheKey = req => `${req.url}-${req.locale}`

// render a page to html and cache it in the appropriate place
const renderAndCache = async (req, res, pagePath, queryParams) => {
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
    console.log(`CACHE HIT: ${key}`)

    res.send(cached)
    return
  }

  // otherwise server-render the page and cache/return it
  console.log(`CACHE MISS: ${key}`)
  try {
    const html = await app.renderToHTML(req, res, pagePath, queryParams)

    res.send(html)
    cache.set(key, html)
  } catch (e) {
    app.renderError(e, req, res, pagePath, queryParams)
  }
}

app
  .prepare()
  .then(() => {
    const server = express()

    connectCache()

    const middleware = [
      // compress using gzip
      compression(),
      // secure the server with helmet
      helmet({
        hsts: false,
      }),
    ]

    if (process.env.STATIC_PATH) {
      // static file serving from public folder
      express.static(process.env.STATIC_PATH, join(__dirname, 'public'))
    }

    // activate morgan logging in production
    if (!dev) {
      middleware.push(morgan('combined'))
    }

    server.use(...middleware)

    server.get('/', (req, res) => {
      renderAndCache(req, res, '/')
    })

    server.get('/join/:shortname', (req, res) => {
      renderAndCache(req, res, '/join', { shortname: req.params.shortname })
    })

    server.get('/sessions/evaluation/:sessionId', (req, res) => {
      app.render(req, res, '/sessions/evaluation', { sessionId: req.params.sessionId })
    })

    server.get('*', (req, res) => {
      const accept = accepts(req)
      const locale = accept.language(dev ? ['en'] : languages)
      req.locale = locale
      req.localeDataScript = getLocaleDataScript(locale)
      req.messages = dev ? {} : getMessages(locale)

      return handle(req, res)
    })

    server.listen(3000, (err) => {
      if (err) throw err
      console.log('> Ready on http://localhost:3000')
    })
  })
  .catch((err) => {
    console.error(err.stack)
    process.exit(1)
  })
