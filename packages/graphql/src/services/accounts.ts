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
  const user = await ctx.prisma.user.findFirst({
    where: {
      email,
      password,
    },
  })

  if (!user) throw new Error('LOGIN_FAILED')

  const jwt = JWT.sign(
    {
      sub: user.id,
      role: user.role,
    },
    // TODO: use structured configuration approach
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '1w',
    }
  )

  ctx.res.cookie('user_token', jwt, {
    domain: process.env.COOKIE_DOMAIN ?? process.env.API_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  })

  return user.id
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
