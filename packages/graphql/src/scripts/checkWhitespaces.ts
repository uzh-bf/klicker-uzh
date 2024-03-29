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

    const email = user.email
    const trimmedEmail = email.trim()

    if (email !== trimmedEmail) {
      console.log(`User ${user.id} has an email with whitespaces: ${email}`)
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

  // fetch all participant groups
  const participantGroups = await prisma.participantGroup.findMany()

  // iterate over all participant groups and print the names which do not match their trimmed version
  participantGroups.forEach((participantGroup) => {
    const name = participantGroup.name
    const trimmedName = name.trim()

    if (name !== trimmedName) {
      console.log(
        `ParticipantGroup ${participantGroup.id} has a name with whitespaces: ${name}`
      )
    }
  })

  // fetch all courses and check name and displayName
  const courses = await prisma.course.findMany()

  // iterate over all courses and print the names which do not match their trimmed version
  courses.forEach((course) => {
    const name = course.name
    const trimmedName = name.trim()

    if (name !== trimmedName) {
      console.log(`Course ${course.id} has a name with whitespaces: ${name}`)
    }

    const displayName = course.displayName
    const trimmedDisplayName = displayName.trim()

    if (displayName !== trimmedDisplayName) {
      console.log(
        `Course ${course.id} has a displayName with whitespaces: ${displayName}`
      )
    }
  })

  // check name and displayName of all microlearnings
  const microlearnings = await prisma.microLearning.findMany()

  // iterate over all microlearnings and print the names which do not match their trimmed version
  microlearnings.forEach((microlearning) => {
    const name = microlearning.name
    const trimmedName = name.trim()

    if (name !== trimmedName) {
      console.log(
        `Microlearning ${microlearning.id} has a name with whitespaces: ${name}`
      )
    }

    const displayName = microlearning.displayName
    const trimmedDisplayName = displayName.trim()

    if (displayName !== trimmedDisplayName) {
      console.log(
        `Microlearning ${microlearning.id} has a displayName with whitespaces: ${displayName}`
      )
    }
  })

  // check name and displayName of all practice quizzes
  const practiceQuizzes = await prisma.practiceQuiz.findMany()

  // iterate over all practice quizzes and print the names which do not match their trimmed version
  practiceQuizzes.forEach((practiceQuiz) => {
    const name = practiceQuiz.name
    const trimmedName = name.trim()

    if (name !== trimmedName) {
      console.log(
        `PracticeQuiz ${practiceQuiz.id} has a name with whitespaces: ${name}`
      )
    }

    const displayName = practiceQuiz.displayName
    const trimmedDisplayName = displayName.trim()

    if (displayName !== trimmedDisplayName) {
      console.log(
        `PracticeQuiz ${practiceQuiz.id} has a displayName with whitespaces: ${displayName}`
      )
    }
  })

  // TODO: if desired, update live sessions with trimmed name and displayNames (too many for manual update)
  // // check name and displayName of all live sessions
  // const liveSessions = await prisma.liveSession.findMany()

  // // iterate over all live sessions and print the names which do not match their trimmed version
  // liveSessions.forEach((liveSession) => {
  //   const name = liveSession.name
  //   const trimmedName = name.trim()

  //   if (name !== trimmedName) {
  //     console.log(
  //       `LiveSession ${liveSession.id} has a name with whitespaces: ${name}`
  //     )
  //   }

  //   const displayName = liveSession.displayName
  //   const trimmedDisplayName = displayName.trim()

  //   if (displayName !== trimmedDisplayName) {
  //     console.log(
  //       `LiveSession ${liveSession.id} has a displayName with whitespaces: ${displayName}`
  //     )
  //   }
  // })

  await prisma.$disconnect()
}

await run()
