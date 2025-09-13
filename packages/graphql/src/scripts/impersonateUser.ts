import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope } from '@klicker-uzh/prisma/client'
import { signJWT } from '@klicker-uzh/util'
import readline from 'readline'

async function run(email: string) {
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
      expiresIn: '2h',
      issuer: process.env.JWT_ISSUER_API,
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
