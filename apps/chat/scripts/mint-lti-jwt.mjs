import { signJWT } from '@klicker-uzh/util'

const sub = process.argv[2] || `lti-test-${Date.now()}`
const scope = process.argv[3] || 'LTI1.3'

const appSecret = process.env.APP_SECRET
const issuer = process.env.APP_ORIGIN_LTI
const missingEnv = [
  ['APP_SECRET', appSecret],
  ['APP_ORIGIN_LTI', issuer],
]
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missingEnv.length > 0) {
  console.error(`Error: ${missingEnv.join(', ')} must be set`)
  process.exit(1)
}

const jwt = await signJWT(
  { sub, email: `${sub}@example.invalid`, scope },
  appSecret,
  {
    algorithm: 'HS256',
    expiresIn: '5m',
    issuer,
  }
)
console.log(jwt)
