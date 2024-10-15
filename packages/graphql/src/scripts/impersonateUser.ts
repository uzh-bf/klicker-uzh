import { PrismaClient, UserLoginScope } from '@klicker-uzh/prisma'
import JWT from 'jsonwebtoken'
import readline from 'readline'

async function run(email: string) {
  const prisma = new PrismaClient()

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  })

  if (!user) {
    console.error('User not found')
    return
  }

  const jwt = JWT.sign(
    {
      sub: user.id,
      role: user.role,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: user.catalystInstitutional,
      catalystIndividual: user.catalystIndividual,
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '4w',
    }
  )

  console.log(jwt)
}

const readLine = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

readLine.question('Email of user to impersonate:', async (email: string) => {
  await run(email)
  readLine.close()
})
