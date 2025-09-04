import { PrismaClient, UserLoginScope } from '@klicker-uzh/prisma/client'
import { signJWT } from '@klicker-uzh/util'
import { PrismaPg } from '@prisma/adapter-pg'
import readline from 'readline'

async function run(email: string) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  })

  if (!user) {
    console.error('User not found')
    return
  }

  const jwt = await signJWT(
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
