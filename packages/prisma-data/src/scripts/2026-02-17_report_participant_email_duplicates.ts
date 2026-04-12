import { prisma } from '@klicker-uzh/prisma'
import { normalizeEmail } from '@klicker-uzh/util'

interface ParticipantDuplicateReportEntry {
  participantId: string
  username: string
  isSSOAccount: boolean
  lastLoginAt: string | null
  participationCount: number
  accounts: Array<{
    ssoType: string
    ssoId: string
    ssoEmail: string | null
  }>
}

interface DuplicateGroupReport {
  normalizedEmail: string
  participants: ParticipantDuplicateReportEntry[]
}

async function run() {
  const participants = await prisma.participant.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      isSSOAccount: true,
      lastLoginAt: true,
      participations: {
        select: { id: true },
      },
      accounts: {
        select: {
          ssoType: true,
          ssoId: true,
          ssoEmail: true,
        },
        orderBy: {
          ssoType: 'asc',
        },
      },
    },
  })

  const groups = new Map<string, typeof participants>()

  for (const participant of participants) {
    const normalizedEmail = normalizeEmail(participant.email ?? undefined)
    if (!normalizedEmail) continue

    const existing = groups.get(normalizedEmail) ?? []
    existing.push(participant)
    groups.set(normalizedEmail, existing)
  }

  const duplicateGroups: DuplicateGroupReport[] = []

  for (const [normalizedEmail, groupedParticipants] of groups.entries()) {
    if (groupedParticipants.length < 2) continue

    duplicateGroups.push({
      normalizedEmail,
      participants: groupedParticipants.map((participant) => ({
        participantId: participant.id,
        username: participant.username,
        isSSOAccount: participant.isSSOAccount,
        lastLoginAt: participant.lastLoginAt?.toISOString() ?? null,
        participationCount: participant.participations.length,
        accounts: participant.accounts.map((account) => ({
          ssoType: account.ssoType,
          ssoId: account.ssoId,
          ssoEmail: account.ssoEmail ?? null,
        })),
      })),
    })
  }

  duplicateGroups.sort((a, b) =>
    a.normalizedEmail.localeCompare(b.normalizedEmail)
  )

  console.log(
    `Found ${duplicateGroups.length} normalized email(s) with duplicate participant records.`
  )

  for (const duplicateGroup of duplicateGroups) {
    console.log(
      `\n[${duplicateGroup.normalizedEmail}] participants=${duplicateGroup.participants.length}`
    )

    for (const participant of duplicateGroup.participants) {
      console.log(
        `- participantId=${participant.participantId} username=${participant.username} isSSOAccount=${participant.isSSOAccount} lastLoginAt=${participant.lastLoginAt ?? 'null'} participations=${participant.participationCount}`
      )

      if (participant.accounts.length === 0) {
        console.log('  accounts: none')
        continue
      }

      for (const account of participant.accounts) {
        console.log(
          `  account: ssoType=${account.ssoType} ssoId=${account.ssoId} ssoEmail=${account.ssoEmail ?? 'null'}`
        )
      }
    }
  }

  console.log('\nJSON_REPORT_START')
  console.log(JSON.stringify(duplicateGroups, null, 2))
  console.log('JSON_REPORT_END')
}

try {
  await run()
} finally {
  await prisma.$disconnect()
}
