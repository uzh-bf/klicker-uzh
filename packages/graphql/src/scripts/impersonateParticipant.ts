import { PrismaClient, UserRole } from '@klicker-uzh/prisma'
import JWT from 'jsonwebtoken'
import readline from 'readline'

async function run(username: string) {
  const prisma = new PrismaClient()

  const participant = await prisma.participant.findUnique({
    where: {
      username,
    },
  })

  if (!participant) {
    console.error('User not found')
    return
  }

  const jwt = JWT.sign(
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
