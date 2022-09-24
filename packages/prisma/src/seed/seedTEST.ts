import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'

import { COURSE_ID_AMI, COURSE_ID_BF1 } from './constants.js'
import { prepareParticipant } from './helpers.js'

async function seedTest(prisma: Prisma.PrismaClient) {
  const PARTICIPANT_IDS = [
    '6f45065c-667f-4259-818c-c6f6b477eb48',
    '0b7c946c-cfc9-4b82-ac97-b058bf48924b',
    '52c20f0f-f5d4-4354-a5d6-a0c103f2b9ea',
    '16c39a69-03b4-4ce4-a695-e7b93d535598',
    'c48f624e-7de9-4e1b-a16d-82d22e64828f',
    '7cf9a94a-31a6-4c53-85d7-608dfa904e30',
    'f53e6a95-689b-48c0-bfab-6625c04f39ed',
    '46407010-0e7c-4903-9a66-2c8d9d6909b0',
    '84b0ba5d-34bc-45cd-8253-f3e8c340e5ff',
    '05a933a0-b2bc-4551-b7e1-6975140d996d',
  ]

  const participantsTesting = await Promise.all(
    PARTICIPANT_IDS.map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id: PARTICIPANT_IDS[ix],
          password: 'testing',
          username: `testuser${ix + 1}`,
          courseIds: [COURSE_ID_AMI, COURSE_ID_BF1],
        })
      )
    })
  )
}

const prismaClient = new Prisma.PrismaClient()

seedTest(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
