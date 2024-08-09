require('dotenv').config()

const lti = require('ltijs').Provider
const Database = require('ltijs-sequelize')

// Initialize database connection
const db = new Database(
  process.env.LTI_DB_NAME,
  process.env.LTI_DB_USER,
  process.env.LTI_DB_PASS,
  {
    // see https://sequelize.org/api/v6/class/src/sequelize.js~sequelize#instance-constructor-constructor
    host: process.env.LTI_DB_HOST,
    dialect: 'postgres',
    dialectOptions: {
      ssl: process.env.NODE_ENV !== 'development',
    },
  }
)

// Setup LTI provider (postgres)
lti.setup(
  process.env.LTI_ENCRYPTION_KEY,
  {
    plugin: db,
  },
  {
    // Options
    appRoute: '/',
    loginRoute: '/login',
    cookies: {
      secure: true,
      sameSite: 'None',
    },
    devMode: process.env.NODE_ENV === 'development', // needs to be set to false in production
  }
)

// LTI launch callback (token has been verified by ltijs beforehand)
lti.onConnect((token, req, res) => {
  console.log(token)
  const ltik = res.locals.ltik

  res.cookie('ltik', ltik, {
    secure: true,
    sameSite: 'None',
    domain: process.env.COOKIE_DOMAIN,
  })

  const url = process.env.LTI_REDIRECT_URL
  console.log('Redirecting to:', url)

  res.redirect(url)
})

// setup function
const setup = async () => {
  const result = await lti.deploy({ port: process.env.PORT || 4000 })
  console.log(result)

  // Optional: Register platform if you're setting this up for the first time
  const platform = await lti.registerPlatform({
    url: 'https://lms.uzh.ch',
    name: 'OLAT UZH',
    clientId: process.env.LTI_CLIENT_ID,
    authenticationEndpoint: 'https://lms.uzh.ch/lti/auth',
    accesstokenEndpoint: 'https://lms.uzh.ch/lti/token',
    authConfig: { method: 'JWK_SET', key: 'https://lms.uzh.ch/lti/keys' },
  })

  console.log(await platform.platformPublicKey())
}

// Get user and context information
lti.app.get('/info', async (req, res) => {
  console.log('GET-request to /info: ')

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

setup().catch((e) => console.error(e))
