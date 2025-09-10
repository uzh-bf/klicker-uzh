import { prisma } from '@klicker-uzh/prisma'
import { UserRole } from '@klicker-uzh/prisma/client'
import { signJWT } from '@klicker-uzh/util'
import readline from 'readline'

async function run(username: string) {
  const participant = await prisma.participant.findUnique({
    where: {
      username,
    },
  })

  if (!participant) {
    console.error('User not found')
    return
  }

  const jwt = await signJWT(
    {
      sub: participant.id,
      role: UserRole.PARTICIPANT,
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

readLine.question(
  'Username of participant to impersonate:',
  async (username: string) => {
    await run(username)
    readLine.close()
  }
)
