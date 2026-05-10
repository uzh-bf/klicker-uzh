import { signJWT } from '@klicker-uzh/util'

const sub = process.argv[2] || `lti-test-${Date.now()}`
const scope = process.argv[3] || 'LTI1.3'

const jwt = await signJWT(
  { sub, email: `${sub}@example.invalid`, scope },
  process.env.APP_SECRET,
  {
    algorithm: 'HS256',
    expiresIn: '5m',
    issuer: process.env.APP_ORIGIN_LTI,
  }
)
console.log(jwt)
