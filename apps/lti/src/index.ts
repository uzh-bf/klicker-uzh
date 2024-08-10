// @ts-nocheck

import 'dotenv/config'

import { Provider } from 'ltijs'
// import LTIDB from 'ltijs-sequelize'


// // Initialize database connection
// const db = new LTIDB.Database(
//   process.env.LTI_DB_NAME,
//   process.env.LTI_DB_USER,
//   process.env.LTI_DB_PASS,
//   {
//     // see https://sequelize.org/api/v6/class/src/sequelize.js~sequelize#instance-constructor-constructor
//     host: process.env.LTI_DB_HOST,
//     dialect: 'postgres',
//     dialectOptions: {
//       ssl: process.env.NODE_ENV !== 'development',
//     },
//   }
// )

// Setup LTI provider (postgres)
Provider.setup(
  process.env.LTI_ENCRYPTION_KEY as string,
  {
    url: process.env.LTI_DB_CONNECTION_STRING as string,
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
Provider.onConnect((token, req, res) => {
  console.log(token)
  const ltik = res.locals.ltik

  res.cookie('ltik', ltik, {
    secure: true,
    sameSite: 'None',
    domain: process.env.COOKIE_DOMAIN as string,
  })

  const url = process.env.LTI_REDIRECT_URL as string
  console.log('Redirecting to:', url)

  res.redirect(url)
})

// setup function
const setup = async () => {
  const result = await Provider.deploy({ port: Number(process.env.LTI_PORT) ?? 4000 })
  console.log(result)

  // Optional: Register platform if you're setting this up for the first time
  const platform = await Provider.registerPlatform({
    url: 'https://lms.uzh.ch',
    name: 'OLAT UZH',
    clientId: process.env.LTI_CLIENT_ID as string,
    authenticationEndpoint: 'https://lms.uzh.ch/lti/auth',
    accesstokenEndpoint: 'https://lms.uzh.ch/lti/token',
    authConfig: { method: 'JWK_SET', key: 'https://lms.uzh.ch/lti/keys' },
  })

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
