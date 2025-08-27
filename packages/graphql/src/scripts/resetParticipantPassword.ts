import { PrismaClient } from '@klicker-uzh/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import generatePassword from 'generate-password'

async function run(email: string) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const user = await prisma.participant.findUnique({
    where: {
      email,
    },
  })

  if (!user) {
    console.error('Participant not found')
    return
  }

  const newPassword = generatePassword.generate({
    length: 12,
    uppercase: true,
    symbols: false,
    numbers: true,
  })

  console.log(email, newPassword)

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.participant.update({
    where: {
      email,
    },
    data: {
      password: hashedPassword,
    },
  })

  console.log('Changed password')
}

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
})

readline.question(
  'Email of participant to reset password for:',
  async (email: string) => {
    await run(email)
    readline.close()
  }
)
