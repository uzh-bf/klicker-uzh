import { Provider } from 'ltijs'
// @ts-ignore
import Database from 'ltijs-sequelize'

const PROVIDER_OPTIONS = {
  appRoute: '/',
  loginRoute: '/login',
  cookies: {
    secure: true,
    sameSite: 'none',
  },
  devMode: process.env.NODE_ENV === 'development', // needs to be set to false in production
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
Provider.onConnect((token, req, res) => {
  console.log(token)
  const ltik = res.locals.ltik

  res.cookie('ltik', ltik, {
    secure: true,
    sameSite: 'none',
    domain: process.env.COOKIE_DOMAIN as string,
  })

  if (typeof req.query.redirectTo === 'string') {
    const url = req.query.redirectTo as string
    console.log('Redirecting to:', url)
    res.redirect(url)
  } else if (typeof process.env.LTI_REDIRECT_URL === 'string') {
    const url = process.env.LTI_REDIRECT_URL as string
    console.log('Redirecting to:', url)
    res.redirect(url)
  }

  res.end()
})

// setup function
const setup = async () => {
  const result = await Provider.deploy({
    port: Number(process.env.LTI_PORT) ?? 4000,
  })
  console.log(result)

  // Optional: Register platform if you're setting this up for the first time
  const platform = await Provider.registerPlatform({
    url: process.env.LTI_URL as string,
    name: process.env.LTI_NAME as string,
    clientId: process.env.LTI_CLIENT_ID as string,
    authenticationEndpoint: process.env.LTI_AUTH_ENDPOINT as string,
    accesstokenEndpoint: process.env.LTI_TOKEN_ENDPOINT as string,
    authConfig: { method: 'JWK_SET', key: process.env.LTI_KEYS_ENDPOINT as string },
  })

  if (!platform) {
    throw new Error('Failed to register platform')
  }

  console.log(await platform.platformPublicKey())
}

// Get user and context information
Provider.app.get('/info', async (req, res) => {
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
