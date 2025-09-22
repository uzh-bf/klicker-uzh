import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { signJWT } from '@klicker-uzh/util'
import readline from 'readline'

async function run(email: string) {
  const participantAccount = await prisma.participantAccount.findFirst({
    where: { ssoEmail: email, ssoType: 'uzh' },
    include: { participant: true },
  })

  if (!participantAccount) {
    console.error('Participant not found')
    return
  }

  const jwt = await signJWT(
    {
      sub: participantAccount.participant.id,
      email: participantAccount.ssoEmail!,
      scope: UserLoginScope.EDUID,
      role: UserRole.PARTICIPANT,
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '2h',
      issuer: process.env.APP_ORIGIN_AUTH,
    }
  )

  console.log(jwt)

  // return / exit the process
  return process.exit(0)
}

const readLine = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

readLine.question(
  'Email of participant to impersonate:',
  async (email: string) => {
    await run(email)
    readLine.close()
  }
)
