#!/usr/bin/env tsx

import { readFileSync } from 'node:fs'
import { prisma } from '@klicker-uzh/prisma'
import { InvitationStatus } from '@klicker-uzh/prisma/client'
import {
  InvitationEmailMode,
  normalizeMatriculationNumber,
} from '@klicker-uzh/util'
import { parse } from 'csv-parse/sync'
import * as R from 'remeda'
import * as z from 'zod'
import type {
  CreateInvitationsResponse,
  CreateParticipantInvitationInput,
  InvitationResult,
} from '../services/participantInvitations.js'
import {
  acceptParticipantInvitation,
  createParticipantInvitations,
  deduplicateParticipantInvitationInputs,
  findEligibleParticipantIds,
} from '../services/participantInvitations.js'

// Configuration - adjust these values as needed
const CSV_FILE = `src/scripts/invitations_${process.env.CONFIG}.csv`

const DRY_RUN = process.argv.includes('--dry-run')

const csvRowSchema = z
  .object({
    email: z.string(),
    courseId: z.string(),
    matriculationNumber: z.string().optional().nullable(),
  })
  .transform((row) => ({
    email: row.email.trim(),
    courseId: row.courseId.trim(),
    matriculationNumber: normalizeMatriculationNumber(row.matriculationNumber),
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

type ExistingInvitationInfo = {
  id: number
  email: string
  matriculationNumber: string | null
  status: InvitationStatus
  participantId: string | null
  acceptedAt: Date | null
  courseId: string
}

async function run() {
  console.log('=== Participant Invitation Import ===')
  console.log('CSV File:', CSV_FILE)
  const emailMode = InvitationEmailMode.AffiliationsOnly
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
    const courseGroups = new Map<string, CreateParticipantInvitationInput[]>(
      Object.entries(groupedByCourse).map(([courseId, records]) => [
        courseId,
        records.map((record) => ({
          email: record.email,
          matriculationNumber: record.matriculationNumber,
        })),
      ])
    )

    console.log(`Found ${courseGroups.size} unique course(s)`)
    console.log()

    // Process each course group
    let totalCreated = 0
    let totalAutoAccepted = 0
    let totalDuplicates = 0
    let totalMatriculationUpdates = 0
    let totalErrors = 0
    let totalProcessed = 0

    for (const [courseId, invitations] of courseGroups.entries()) {
      console.log(`=== Processing Course: ${courseId} ===`)
      console.log(`Emails to process: ${invitations.length}`)

      try {
        const uniqueInvitations =
          deduplicateParticipantInvitationInputs(invitations)
        const normalizedUniqueEmails = Array.from(
          new Set(
            uniqueInvitations.map((invitation) =>
              invitation.email.toLowerCase()
            )
          )
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
              matriculationNumber: true,
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
        const matriculationByEmail = new Map<string, string>()

        for (const invitation of uniqueInvitations) {
          const normalizedEmail = invitation.email.toLowerCase()

          if (invitation.matriculationNumber) {
            matriculationByEmail.set(
              normalizedEmail,
              invitation.matriculationNumber
            )
          }
        }

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

        const updatedExistingMatriculationCount =
          await updateExistingInvitationMatriculationNumbers(
            existingInvitations,
            matriculationByEmail,
            DRY_RUN
          )

        if (updatedExistingMatriculationCount > 0) {
          console.log(
            `${DRY_RUN ? 'Would update' : 'Updated'} ${updatedExistingMatriculationCount} existing invitation(s) with matriculation number.`
          )
        }

        const filteredInvitations = uniqueInvitations.filter(
          (invitation) => !existingEmailSet.has(invitation.email.toLowerCase())
        )
        const existingInvitationCount =
          uniqueInvitations.length - filteredInvitations.length
        const duplicateInputCount =
          invitations.length - uniqueInvitations.length
        const skippedDuplicateCount =
          (DRY_RUN ? existingInvitationCount : 0) + duplicateInputCount

        if (skippedDuplicateCount > 0) {
          console.log(
            `Found ${skippedDuplicateCount} duplicate invitation input row(s).`
          )
        }

        const manualResults: InvitationResult[] = []
        let remainingInvitations = DRY_RUN
          ? filteredInvitations
          : uniqueInvitations

        if (DRY_RUN) {
          remainingInvitations = []
          for (const invitation of filteredInvitations) {
            const previewResult = await previewParticipantWithoutInvitation(
              invitation,
              emailMode
            )

            if (previewResult) {
              manualResults.push(previewResult)
            } else {
              remainingInvitations.push(invitation)
            }
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

        if (remainingInvitations.length > 0) {
          if (DRY_RUN) {
            const seen = new Set<string>()
            let created = 0
            let duplicates = 0

            const results = remainingInvitations.map((invitation) => {
              const normalized = invitation.email.toLowerCase()

              if (seen.has(normalized)) {
                duplicates += 1
                return {
                  email: invitation.email,
                  status: 'duplicate' as const,
                }
              }

              seen.add(normalized)

              created += 1
              return {
                email: invitation.email,
                status: 'created' as const,
              }
            })

            result = {
              created,
              autoAccepted: 0,
              duplicates,
              errors: 0,
              totalProcessed: remainingInvitations.length,
              results,
            }

            console.log(`Dry run: would create ${created}, skip ${duplicates}.`)
          } else {
            result = await createParticipantInvitations(
              courseId,
              remainingInvitations,
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
          `Skipped (duplicates): ${combinedResult.duplicates + skippedDuplicateCount}`
        )
        console.log(
          `Updated existing (matriculation number): ${updatedExistingMatriculationCount}`
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
        totalDuplicates += combinedResult.duplicates + skippedDuplicateCount
        totalMatriculationUpdates += updatedExistingMatriculationCount
        totalErrors += combinedResult.errors
        totalProcessed += invitations.length
      } catch (error: unknown) {
        console.error(
          `Failed to process course ${courseId}: ${getErrorMessage(error)}`
        )
        totalErrors += invitations.length
        totalProcessed += invitations.length
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
    console.log(
      `Total updated existing (matriculation number): ${totalMatriculationUpdates}`
    )
    console.log(`Total errors: ${totalErrors}`)

    if (
      totalCreated > 0 ||
      totalAutoAccepted > 0 ||
      totalMatriculationUpdates > 0
    ) {
      console.log()
      console.log(
        `Import completed! ${totalCreated} pending invitations created, ${totalAutoAccepted} users auto-enrolled, and ${totalMatriculationUpdates} existing invitations updated across ${courseGroups.size} course(s).`
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
  } catch (error: unknown) {
    console.error('Import failed:', getErrorMessage(error))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function updateExistingInvitationMatriculationNumbers(
  existingInvitations: ExistingInvitationInfo[],
  latestMatriculationByEmail: Map<string, string>,
  dryRun: boolean
): Promise<number> {
  let updatedCount = 0

  for (const existingInvitation of existingInvitations) {
    const incomingMatriculationNumber = latestMatriculationByEmail.get(
      existingInvitation.email.toLowerCase()
    )

    if (
      existingInvitation.status !== InvitationStatus.PENDING ||
      !incomingMatriculationNumber ||
      existingInvitation.matriculationNumber === incomingMatriculationNumber
    ) {
      continue
    }

    if (dryRun) {
      console.log(
        `  Dry run: would update invitation ${existingInvitation.id} (${existingInvitation.email.toLowerCase()}) matriculation number to "${incomingMatriculationNumber}".`
      )
    } else {
      const updateResult = await prisma.participantInvitation.updateMany({
        where: {
          id: existingInvitation.id,
          status: InvitationStatus.PENDING,
          matriculationNumber: existingInvitation.matriculationNumber,
        },
        data: {
          matriculationNumber: incomingMatriculationNumber,
        },
      })
      if (updateResult.count === 1) {
        console.log(
          `  Updated invitation ${existingInvitation.id} (${existingInvitation.email.toLowerCase()}) matriculation number to "${incomingMatriculationNumber}".`
        )
      }

      if (updateResult.count === 0) continue
    }

    updatedCount += 1
  }

  return updatedCount
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
        case 'duplicate_updated':
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

async function previewParticipantWithoutInvitation(
  invitation: CreateParticipantInvitationInput,
  emailMode: InvitationEmailMode
): Promise<InvitationResult | null> {
  const normalizedEmail = invitation.email.toLowerCase()
  const matriculationNumber = invitation.matriculationNumber ?? null

  const participantIds = await findEligibleParticipantIds(
    normalizedEmail,
    emailMode,
    prisma
  )

  if (participantIds.length !== 1) {
    return null
  }

  const participantId = participantIds[0]

  const matriculationSuffix = matriculationNumber
    ? ` and set matriculation number "${matriculationNumber}"`
    : ''
  console.log(
    `  Dry run: would create ACCEPTED invitation for ${normalizedEmail}${matriculationSuffix} and preserve or create inactive participation for participant ${participantId}.`
  )

  return {
    email: invitation.email,
    status: 'auto_accepted',
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

  const participantIds = await findEligibleParticipantIds(
    normalizedEmail,
    emailMode,
    prisma
  )

  if (participantIds.length === 0) {
    console.warn(
      `  Warning: No verified participant account found for ${normalizedEmail}. Manual review required.`
    )
    return
  }

  if (participantIds.length > 1) {
    console.warn(
      `  Warning: Multiple active participants found for ${normalizedEmail}. Manual review required.`
    )
    return
  }

  const participantId = participantIds[0]

  if (dryRun) {
    console.log(
      `  Dry run: would link invitation ${invitation.id} to participant ${participantId} and preserve or create inactive participation.`
    )
    return
  }

  let repaired = false
  try {
    const result = await acceptParticipantInvitation({
      invitationId: invitation.id,
      courseId: invitation.courseId,
      participantId,
      acceptedAt: invitation.acceptedAt,
    })
    repaired = result.invitationId === invitation.id
  } catch (error) {
    console.warn(
      `  Skipped repair for invitation ${invitation.id}: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!repaired) {
    console.warn(
      `  Skipped repair for invitation ${invitation.id}: the invitation or eligible participant changed during the transaction.`
    )
    return
  }

  console.log(
    `  Fixed: linked invitation ${invitation.id} to participant ${participantId} and preserved course participation.`
  )
}

// Run the script
run().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
