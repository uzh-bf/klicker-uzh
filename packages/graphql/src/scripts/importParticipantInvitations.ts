#!/usr/bin/env tsx

import { PrismaClient } from '@klicker-uzh/prisma/client'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'

interface ImportOptions {
  courseId: string
  file: string
  dryRun?: boolean
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2)
  const options: Partial<ImportOptions> = {}

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
    const value = args[i + 1]

    if (key === '--courseId') {
      options.courseId = value
    } else if (key === '--file') {
      options.file = value
    } else if (key === '--dry-run') {
      options.dryRun = true
      i-- // --dry-run doesn't have a value
    }
  }

  if (!options.courseId || !options.file) {
    console.error(
      'Usage: npx tsx packages/graphql/src/scripts/import-participant-invitations.ts --courseId="uuid" --file="invitations.csv" [--dry-run]'
    )
    process.exit(1)
  }

  return options as ImportOptions
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

async function run() {
  const { courseId, file, dryRun } = parseArgs()
  const prisma = new PrismaClient()

  console.log('=== Participant Invitation Import ===')
  console.log('Course ID:', courseId)
  console.log('CSV File:', file)
  console.log('Dry Run:', dryRun ? 'Yes' : 'No')
  console.log()

  try {
    // Verify the course exists and is assessment enabled
    console.log('Verifying course...')
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    })

    if (!course) {
      console.error('❌ Course not found')
      process.exit(1)
    }

    if (!course.isAssessmentEnabled) {
      console.error(
        '❌ Course is not assessment enabled. Only assessment courses can have invitations.'
      )
      process.exit(1)
    }

    console.log(
      `✅ Course "${course.displayName}" is valid and assessment enabled`
    )
    console.log()

    // Read and parse CSV file
    console.log('Reading CSV file...')
    const csvContent = readFileSync(file, 'utf-8')
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    console.log(`✅ Found ${records.length} rows in CSV`)
    console.log()

    // Validate CSV structure
    if (records.length === 0) {
      console.error('❌ CSV file is empty')
      process.exit(1)
    }

    if (!records[0].email) {
      console.error('❌ CSV must have an "email" column')
      process.exit(1)
    }

    // Process invitations
    let totalProcessed = 0
    let created = 0
    let duplicates = 0
    const errors: string[] = []

    console.log('Processing invitations...')

    for (const record of records) {
      totalProcessed++
      const email = record.email?.toLowerCase()?.trim()

      if (!email) {
        errors.push(`Row ${totalProcessed}: Email is empty`)
        continue
      }

      if (!validateEmail(email)) {
        errors.push(`Row ${totalProcessed}: Invalid email format: ${email}`)
        continue
      }

      try {
        if (!dryRun) {
          // Check for existing invitation
          const existingInvitation =
            await prisma.participantInvitation.findUnique({
              where: {
                email_courseId: {
                  email,
                  courseId,
                },
              },
            })

          if (existingInvitation) {
            duplicates++
            console.log(
              `⚠️  Duplicate invitation for ${email} (status: ${existingInvitation.status})`
            )
            continue
          }

          // Create the invitation
          await prisma.participantInvitation.create({
            data: {
              email,
              courseId,
              status: 'PENDING',
            },
          })

          created++
          console.log(`✅ Created invitation for ${email}`)
        } else {
          // In dry run mode, just check for duplicates
          const existingInvitation =
            await prisma.participantInvitation.findUnique({
              where: {
                email_courseId: {
                  email,
                  courseId,
                },
              },
            })

          if (existingInvitation) {
            duplicates++
            console.log(`[DRY RUN] Would skip duplicate: ${email}`)
          } else {
            created++
            console.log(`[DRY RUN] Would create invitation for: ${email}`)
          }
        }
      } catch (error: any) {
        errors.push(
          `Row ${totalProcessed}: Error processing ${email}: ${error.message}`
        )
      }
    }

    console.log()
    console.log('=== Import Results ===')
    console.log(`Total rows processed: ${totalProcessed}`)
    console.log(
      `${dryRun ? 'Would create' : 'Successfully created'}: ${created}`
    )
    console.log(`Skipped (duplicates): ${duplicates}`)
    console.log(`Errors: ${errors.length}`)

    if (errors.length > 0) {
      console.log()
      console.log('=== Errors ===')
      errors.forEach((error) => console.log(`❌ ${error}`))
    }

    if (dryRun) {
      console.log()
      console.log(
        'ℹ️  This was a dry run. No invitations were actually created.'
      )
      console.log('   Remove --dry-run flag to execute the import.')
    } else if (created > 0) {
      console.log()
      console.log(
        `✅ Import completed successfully! ${created} invitations created.`
      )
      console.log(
        '   Participants will be automatically enrolled when they log in via eduID.'
      )
    }
  } catch (error: any) {
    console.error('❌ Import failed:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
run().catch((error) => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})
