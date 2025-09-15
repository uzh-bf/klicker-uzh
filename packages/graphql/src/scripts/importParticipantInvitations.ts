#!/usr/bin/env tsx

import { prisma } from '@klicker-uzh/prisma'
import { InvitationStatus } from '@klicker-uzh/prisma/client'
import {
  DEFAULT_INVITATION_EMAIL_MODE,
  InvitationEmailMode,
  resolveInvitationEmailMode,
} from '@klicker-uzh/util'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import * as R from 'remeda'
import * as z from 'zod'
import type {
  CreateInvitationsResponse,
  InvitationResult,
} from '../services/participantInvitations.js'
import { createParticipantInvitations } from '../services/participantInvitations.js'

// Configuration - adjust these values as needed
const CSV_FILE = `src/scripts/invitations_${process.env.CONFIG}.csv`

const DRY_RUN = process.argv.includes('--dry-run')

const csvRowSchema = z
  .object({
    email: z.string(),
    courseId: z.string(),
  })
  .transform((row) => ({
    email: row.email.trim(),
    courseId: row.courseId.trim(),
  }))
  .refine((row) => row.email.length > 0, {
    message: 'email is required',
    path: ['email'],
  })
  .refine((row) => row.courseId.length > 0, {
    message: 'courseId is required',
    path: ['courseId'],
  })

type CsvRow = z.infer<typeof csvRowSchema>

type ExistingInvitationInfo = {
  id: number
  email: string
  status: InvitationStatus
  participantId: string | null
  acceptedAt: Date | null
  courseId: string
}

async function run() {
  console.log('=== Participant Invitation Import ===')
  console.log('CSV File:', CSV_FILE)
  const emailMode = resolveInvitationEmailMode(
    process.env.PARTICIPANT_INVITATION_EMAIL_MODE ??
      DEFAULT_INVITATION_EMAIL_MODE
  )
  console.log('Invitation email mode:', emailMode)
  console.log('Dry run:', DRY_RUN ? 'enabled' : 'disabled')
  console.log()

  try {
    // Read and parse CSV file
    console.log('Reading CSV file...')
    const csvContent = readFileSync(CSV_FILE, 'utf-8')
    const rawRecords = parse<Record<string, unknown>>(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      // Handle UTF-8 BOM in files exported from Excel/Numbers (as in PRD CSV)
      bom: true,
    })

    console.log(`Found ${rawRecords.length} rows in CSV`)
    console.log()

    if (rawRecords.length === 0) {
      console.error('CSV file is empty')
      process.exit(1)
    }

    const normalizedRecords: CsvRow[] = []

    rawRecords.forEach((record, index) => {
      const parsed = csvRowSchema.safeParse(record)

      if (!parsed.success) {
        console.warn(
          `Skipping row ${index + 1}: ${parsed.error.issues
            .map((issue) => issue.message)
            .join(', ')}`
        )
        return
      }

      normalizedRecords.push(parsed.data)
    })

    if (normalizedRecords.length === 0) {
      console.error('CSV does not contain any valid invitation rows')
      process.exit(1)
    }

    const groupedByCourse = R.groupBy(
      normalizedRecords,
      (record) => record.courseId
    )
    const courseGroups = new Map(
      Object.entries(groupedByCourse).map(([courseId, records]) => [
        courseId,
        records.map((record) => record.email),
      ])
    )

    console.log(`Found ${courseGroups.size} unique course(s)`)
    console.log()

    // Process each course group
    let totalCreated = 0
    let totalAutoAccepted = 0
    let totalDuplicates = 0
    let totalErrors = 0
    let totalProcessed = 0

    for (const [courseId, emails] of courseGroups.entries()) {
      console.log(`=== Processing Course: ${courseId} ===`)
      console.log(`Emails to process: ${emails.length}`)

      try {
        const normalizedUniqueEmails = Array.from(
          new Set(emails.map((email) => email.toLowerCase()))
        )

        const existingInvitations: ExistingInvitationInfo[] =
          await prisma.participantInvitation.findMany({
            where: {
              courseId,
              email: { in: normalizedUniqueEmails },
            },
            select: {
              id: true,
              email: true,
              status: true,
              participantId: true,
              acceptedAt: true,
              courseId: true,
            },
          })

        const existingEmailSet = new Set(
          existingInvitations.map((invitation) =>
            invitation.email.toLowerCase()
          )
        )

        const brokenInvitations = existingInvitations.filter(
          (invitation) =>
            invitation.status === InvitationStatus.ACCEPTED &&
            !invitation.participantId
        )

        if (brokenInvitations.length > 0) {
          console.log(
            `Found ${brokenInvitations.length} accepted invitation(s) without participant link.`
          )

          for (const invitation of brokenInvitations) {
            await resolveBrokenAcceptedInvitation(
              invitation,
              emailMode,
              DRY_RUN
            )
          }
        }

        const filteredEmails = emails.filter(
          (email) => !existingEmailSet.has(email.toLowerCase())
        )
        const skippedExistingCount = emails.length - filteredEmails.length

        if (skippedExistingCount > 0) {
          console.log(
            `Skipping ${skippedExistingCount} already existing invitation(s).`
          )
        }

        const manualResults: InvitationResult[] = []
        const remainingEmails: string[] = []

        for (const email of filteredEmails) {
          const manualResult = await resolveParticipantWithoutInvitation(
            email,
            courseId,
            emailMode,
            DRY_RUN
          )

          if (manualResult) {
            manualResults.push(manualResult)
          } else {
            remainingEmails.push(email)
          }
        }

        const manualSummary = summarizeInvitationResults(manualResults)

        let result: CreateInvitationsResponse = {
          created: 0,
          autoAccepted: 0,
          duplicates: 0,
          errors: 0,
          totalProcessed: 0,
          results: [],
        }

        if (remainingEmails.length > 0) {
          if (DRY_RUN) {
            const normalizedFiltered = remainingEmails.map((email) =>
              email.toLowerCase()
            )

            const autoAcceptCandidates =
              await prisma.participantAccount.findMany({
                where: {
                  ssoEmail: { in: normalizedFiltered },
                  isVerified: true,
                  ...(emailMode === InvitationEmailMode.AffiliationsOnly
                    ? { type: 'affiliation' }
                    : {}),
                },
                select: {
                  ssoEmail: true,
                },
              })

            const autoAcceptSet = new Set(
              autoAcceptCandidates
                .map((account) => account.ssoEmail?.toLowerCase())
                .filter((email): email is string => Boolean(email))
            )

            const seen = new Set<string>()
            let created = 0
            let autoAccepted = 0
            let duplicates = 0

            const results = remainingEmails.map((email) => {
              const normalized = email.toLowerCase()

              if (seen.has(normalized)) {
                duplicates += 1
                return {
                  email,
                  status: 'duplicate' as const,
                }
              }

              seen.add(normalized)

              if (autoAcceptSet.has(normalized)) {
                autoAccepted += 1
                return {
                  email,
                  status: 'auto_accepted' as const,
                }
              }

              created += 1
              return {
                email,
                status: 'created' as const,
              }
            })

            result = {
              created,
              autoAccepted,
              duplicates,
              errors: 0,
              totalProcessed: remainingEmails.length,
              results,
            }

            console.log(
              `Dry run: would create ${created}, auto-accept ${autoAccepted}, skip ${duplicates}.`
            )
          } else {
            result = await createParticipantInvitations(
              courseId,
              remainingEmails,
              {
                emailMode,
              }
            )
          }
        }

        const combinedResult: CreateInvitationsResponse = {
          created: result.created + manualSummary.created,
          autoAccepted: result.autoAccepted + manualSummary.autoAccepted,
          duplicates: result.duplicates + manualSummary.duplicates,
          errors: result.errors + manualSummary.errors,
          totalProcessed: result.totalProcessed + manualSummary.totalProcessed,
          results: [...manualResults, ...result.results],
        }

        console.log(`Created (PENDING): ${combinedResult.created}`)
        console.log(
          `Auto-accepted (existing users): ${combinedResult.autoAccepted}`
        )
        console.log(
          `Skipped (duplicates): ${combinedResult.duplicates + skippedExistingCount}`
        )
        console.log(`Errors: ${combinedResult.errors}`)

        // Group results by status for this course
        const resultsByStatus = R.groupBy(
          combinedResult.results,
          R.prop('status')
        )

        // Show auto-accepted users for this course
        const autoAcceptedResults = resultsByStatus.auto_accepted || []
        if (autoAcceptedResults.length > 0) {
          autoAcceptedResults.forEach((result) => {
            console.log(
              `  Auto-accepted: ${result.email} → ${result.participantId}`
            )
          })
        }

        // Show errors for this course
        const errorResults = resultsByStatus.error || []
        if (errorResults.length > 0) {
          errorResults.forEach((result) => {
            console.log(`  Error: ${result.email}: ${result.error}`)
          })
        }

        // Aggregate totals
        totalCreated += combinedResult.created
        totalAutoAccepted += combinedResult.autoAccepted
        totalDuplicates += combinedResult.duplicates + skippedExistingCount
        totalErrors += combinedResult.errors
        totalProcessed += emails.length
      } catch (error: any) {
        console.error(`Failed to process course ${courseId}: ${error.message}`)
        totalErrors += emails.length
        totalProcessed += emails.length
      }

      console.log()
    }

    // Show final totals
    console.log('=== Total Results ===')
    console.log(`Courses processed: ${courseGroups.size}`)
    console.log(`Total rows processed: ${totalProcessed}`)
    console.log(`Total created (PENDING): ${totalCreated}`)
    console.log(`Total auto-accepted: ${totalAutoAccepted}`)
    console.log(`Total duplicates: ${totalDuplicates}`)
    console.log(`Total errors: ${totalErrors}`)

    if (totalCreated > 0 || totalAutoAccepted > 0) {
      console.log()
      console.log(
        `Import completed! ${totalCreated} pending invitations created, ${totalAutoAccepted} users auto-enrolled across ${courseGroups.size} course(s).`
      )
      console.log(
        'Pending participants will be automatically enrolled when they log in via eduID.'
      )
      if (totalAutoAccepted > 0) {
        console.log(
          'Auto-enrolled participants can access their courses immediately.'
        )
      }
    }
  } catch (error: any) {
    console.error('Import failed:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

function summarizeInvitationResults(results: InvitationResult[]) {
  return results.reduce(
    (summary, result) => {
      summary.totalProcessed += 1

      switch (result.status) {
        case 'created':
          summary.created += 1
          break
        case 'auto_accepted':
          summary.autoAccepted += 1
          break
        case 'duplicate':
          summary.duplicates += 1
          break
        case 'error':
          summary.errors += 1
          break
      }

      return summary
    },
    {
      created: 0,
      autoAccepted: 0,
      duplicates: 0,
      errors: 0,
      totalProcessed: 0,
    }
  )
}

async function resolveParticipantWithoutInvitation(
  email: string,
  courseId: string,
  emailMode: InvitationEmailMode,
  dryRun: boolean
): Promise<InvitationResult | null> {
  const normalizedEmail = email.toLowerCase()

  const participantAccount = await prisma.participantAccount.findFirst({
    where: {
      ssoEmail: normalizedEmail,
      isVerified: true,
      ...(emailMode === InvitationEmailMode.AffiliationsOnly
        ? { type: 'affiliation' }
        : {}),
    },
    include: {
      participant: true,
    },
  })

  if (!participantAccount || !participantAccount.participant) {
    return null
  }

  const participantId = participantAccount.participantId

  const existingParticipation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
  })
  const hadParticipation = Boolean(existingParticipation)

  if (dryRun) {
    console.log(
      `  Dry run: would create ACCEPTED invitation for ${normalizedEmail} and ${existingParticipation ? 'activate existing participation' : 'create participation'} for participant ${participantId}.`
    )

    return {
      email,
      status: 'auto_accepted',
      participantId,
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const invitation = await tx.participantInvitation.create({
      data: {
        email: normalizedEmail,
        courseId,
        status: InvitationStatus.ACCEPTED,
        participantId,
        acceptedAt: new Date(),
      },
    })

    await tx.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
      create: {
        courseId,
        participantId,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })

    return invitation.id
  })

  console.log(
    `  Linked participant ${participantId} to new ACCEPTED invitation for ${normalizedEmail} (${hadParticipation ? 'reactivated participation' : 'created participation'}).`
  )

  return {
    email,
    status: 'auto_accepted',
    invitationId: result,
    participantId,
  }
}

async function resolveBrokenAcceptedInvitation(
  invitation: ExistingInvitationInfo,
  emailMode: InvitationEmailMode,
  dryRun: boolean
) {
  const normalizedEmail = invitation.email.toLowerCase()

  console.log(
    `Checking accepted invitation ${invitation.id} for ${normalizedEmail}`
  )

  const participantAccounts = await prisma.participantAccount.findMany({
    where: {
      ssoEmail: normalizedEmail,
      isVerified: true,
      ...(emailMode === InvitationEmailMode.AffiliationsOnly
        ? { type: 'affiliation' }
        : {}),
    },
    include: {
      participant: true,
    },
  })

  const accountWithParticipant = participantAccounts.find(
    (account) => account.participant
  )

  if (!accountWithParticipant || !accountWithParticipant.participant) {
    console.warn(
      `  Warning: No verified participant account found for ${normalizedEmail}. Manual review required.`
    )
    return
  }

  if (participantAccounts.length > 1) {
    console.warn(
      `  Note: Multiple participant accounts found for ${normalizedEmail}. Using ${accountWithParticipant.participantId}.`
    )
  }

  const participantId = accountWithParticipant.participantId

  const existingParticipation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId: invitation.courseId,
        participantId,
      },
    },
  })

  if (dryRun) {
    console.log(
      `  Dry run: would link invitation ${invitation.id} to participant ${participantId} and ${existingParticipation ? 'activate existing participation' : 'create participation'}.`
    )
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.participantInvitation.update({
      where: { id: invitation.id },
      data: {
        participantId,
        status: InvitationStatus.ACCEPTED,
        acceptedAt: invitation.acceptedAt ?? new Date(),
      },
    })

    await tx.participation.upsert({
      where: {
        courseId_participantId: {
          courseId: invitation.courseId,
          participantId,
        },
      },
      create: {
        courseId: invitation.courseId,
        participantId,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })
  })

  console.log(
    `  Fixed: linked invitation ${invitation.id} to participant ${participantId} and ensured course participation.`
  )
}

// Run the script
run().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
