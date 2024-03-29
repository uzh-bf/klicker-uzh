import { PrismaClient } from '@klicker-uzh/prisma'

async function run() {
  const prisma = new PrismaClient()

  // fetch all participants
  const participants = await prisma.participant.findMany({
    include: {
      participations: true,
    },
  })

  // compare the email to its lowercase version and print the email if they are different
  let emails = []
  for (const participant of participants) {
    if (!participant.email) {
      continue
    }
    if (participant.email !== participant.email.toLowerCase()) {
      emails.push(participant.email)
    }
  }

  console.log(
    'Total remaining number of participants with email mismatch:',
    emails.length
  )

  for (const email of emails) {
    console.log(
      'Email not all lower-case:',
      email,
      'with XP:',
      participants.find((p) => p.email === email)?.xp,
      'and participations:',
      participants.find((p) => p.email === email)?.participations.length,
      'sso account:',
      participants.find((p) => p.email === email)?.isSSOAccount
    )

    // check if another account with all lower case email exists
    const participant = await prisma.participant.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    })
    if (participant) {
      console.log(
        'Account with all lower-case email exists:',
        participant.email,
        'with sso:',
        participant.isSSOAccount
      )
    }
  }
}

await run()
