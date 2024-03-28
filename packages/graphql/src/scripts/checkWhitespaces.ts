import { PrismaClient } from '@klicker-uzh/prisma'

async function run() {
  const prisma = new PrismaClient()

  // fetch all users
  const users = await prisma.user.findMany()

  // iterate over all users and print the shortnames, which do not match their trimmed version
  users.forEach((user) => {
    const shortname = user.shortname
    const trimmedShortname = shortname.trim()

    if (shortname !== trimmedShortname) {
      console.log(
        `User ${user.id} has a shortname with whitespaces: ${shortname}`
      )
    }
  })

  // fetch all participants
  const participants = await prisma.participant.findMany()

  // iterate over all participants and print the usernames / emails which do not match their trimmed version
  participants.forEach((participant) => {
    const username = participant.username
    const trimmedUsername = username.trim()

    if (username !== trimmedUsername) {
      console.log(
        `Participant ${participant.id} has a username with whitespaces: ${username}`
      )
    }

    const email = participant.email
    const trimmedEmail = email?.trim()

    if (email && email !== trimmedEmail) {
      console.log(
        `Participant ${participant.id} has an email with whitespaces: ${email}`
      )
    }
  })

  await prisma.$disconnect()
}

await run()
