import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'

// Links the devcontainer's local Edu-ID mock to a seeded participant.
//
// The mock signs in a fixed synthetic identity (`sub=local-eduid-dev`,
// `testuser2@test.uzh.ch`). Without this row a sign-in would create a SECOND
// participant with the same email: `Participant` is unique on
// (email, isSSOAccount), and every seeded participant is a manual account
// (isSSOAccount=false), so the SSO variant does not collide. Linking the mock
// identity to the seeded participant keeps the seeded courses, participations,
// and invitations reachable instead.
//
// Only `ParticipantAccount` is written. The participant keeps
// isSSOAccount=false so password login keeps working alongside the SSO login.

const MOCK_SSO_ID = 'local-eduid-dev'
const MOCK_SSO_TYPE = 'EDUID'
const SEEDED_USERNAME = 'testuser2'

async function main() {
  await requireDisposableDatabase(prisma)

  const participant = await prisma.participant.findUnique({
    where: { username: SEEDED_USERNAME },
    select: { id: true, email: true },
  })
  if (!participant) {
    throw new Error(
      `Seeded participant ${SEEDED_USERNAME} is missing; run the seed first`
    )
  }

  await prisma.participantAccount.upsert({
    where: { ssoId: MOCK_SSO_ID },
    create: {
      ssoId: MOCK_SSO_ID,
      ssoType: MOCK_SSO_TYPE,
      ssoEmail: participant.email ?? undefined,
      type: 'sso',
      isPrimary: true,
      isVerified: true,
      participant: { connect: { id: participant.id } },
    },
    update: {
      ssoEmail: participant.email ?? undefined,
      isVerified: true,
      participant: { connect: { id: participant.id } },
    },
  })

  console.log(
    `Linked local Edu-ID mock (${MOCK_SSO_ID}) to participant ${SEEDED_USERNAME} (${participant.id}).`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
