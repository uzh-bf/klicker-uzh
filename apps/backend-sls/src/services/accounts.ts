import JWT from 'jsonwebtoken'
import { Context } from '../lib/context'

interface LoginArgs {
  email: string
  password: string
}

export async function login(
  { email, password }: LoginArgs,
  ctx: Context
): Promise<string> {
  const jwt = JWT.sign(
    {
      sub: '1',
      email,
    },
    'abcd',
    {
      algorithm: 'HS256',
      expiresIn: '1w',
    }
  )

  console.warn(ctx.prisma)

  const user = await ctx.prisma.user.findFirst({
    where: {
      email,
      password,
    },
  })

  console.warn(user)

  if (!user) throw new Error('LOGIN_FAILED')

  ctx.res.cookie('jwt', jwt, {
    domain: 'localhost',
    path: '/api/graphql',
    // domain: APP_CFG.cookieDomain || APP_CFG.domain,
    // httpOnly: true,
    // maxAge: 86400000,
    // path: APP_CFG.path ? `${APP_CFG.path}/graphql` : '/graphql',
    // secure: !isDev && APP_CFG.https,
  })

  return '1'
  // if (!isEmail(email)) {
  //   throw new UserInputError(Errors.INVALID_EMAIL)
  // }
  // normalize the email address
  // const normalizedEmail = normalizeEmail(email)
  // // look for a single user with the given email
  // const user = await UserModel.findOne({
  //   email: normalizedEmail,
  // })
  // const invalidLogin = () => {
  //   sendSlackNotification('accounts', `Login failed for ${email}`)
  //   throw new AuthenticationError(Errors.INVALID_LOGIN)
  // }
  // // check whether the user exists
  // if (!user) {
  //   invalidLogin()
  // }
  // // check whether the account is already active
  // if (!user.isActive) {
  //   throw new AuthenticationError(Errors.ACCOUNT_NOT_ACTIVATED)
  // }
  // // check if hashed passwords match
  // if (!bcrypt.compareSync(password, user.password)) {
  //   invalidLogin()
  // }
  // // generate a JWT for future authentication
  // // TODO: add more necessary properties for the JWT
  // const jwt = JWT.sign(generateJwtSettings(user), APP_CFG.secret, {
  //   algorithm: 'HS256',
  //   expiresIn: '1w',
  // })
  // // set a cookie with the generated JWT
  // if (res && res.cookie) {
  //   res.cookie('jwt', jwt, AUTH_COOKIE_SETTINGS)
  // }
  // // update the last login date
  // await UserModel.findOneAndUpdate(
  //   { email: normalizedEmail },
  //   { $currentDate: { lastLoginAt: true } }
  // )
  // // resolve with data about the user
  // return user.id
}
