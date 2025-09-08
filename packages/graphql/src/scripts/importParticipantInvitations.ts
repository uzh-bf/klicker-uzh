#!/usr/bin/env tsx

import { prisma } from '@klicker-uzh/prisma'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { createParticipantInvitations } from '../services/participantInvitations.js'

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
      'Usage: npx tsx packages/graphql/src/scripts/importParticipantInvitations.ts --courseId="uuid" --file="invitations_dev.csv" [--dry-run]'
    )
    process.exit(1)
  }

  return options as ImportOptions
}

async function run() {
  const { courseId, file, dryRun } = parseArgs()

  console.log('=== Participant Invitation Import ===')
  console.log('Course ID:', courseId)
  console.log('CSV File:', file)
  console.log('Dry Run:', dryRun ? 'Yes' : 'No')
  console.log()

  try {
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

    // Extract emails from CSV
    const emails = records.map((record) => record.email).filter(Boolean)

    console.log('Processing invitations...')

    // Use the new service to create invitations
    const result = await createParticipantInvitations(courseId, emails, {
      dryRun,
      batchSize: 50,
    })

    console.log()
    console.log('=== Import Results ===')
    console.log(`Total rows processed: ${result.totalProcessed}`)
    console.log(
      `${dryRun ? 'Would create (PENDING)' : 'Successfully created (PENDING)'}: ${result.created}`
    )
    console.log(
      `${dryRun ? 'Would auto-accept (existing users)' : 'Auto-accepted (existing users)'}: ${result.autoAccepted}`
    )
    console.log(`Skipped (duplicates): ${result.duplicates}`)
    console.log(`Errors: ${result.errors}`)

    // Show auto-accepted users
    if (result.autoAccepted > 0) {
      console.log()
      console.log('=== Auto-Accepted Users ===')
      const autoAcceptedResults = result.results.filter(
        (r) => r.status === 'auto_accepted'
      )
      autoAcceptedResults.forEach((result) => {
        const prefix = dryRun
          ? '[DRY RUN] Would auto-accept'
          : '✅ Auto-accepted'
        console.log(`${prefix}: ${result.email} → ${result.participantId}`)
      })
    }

    // Show errors
    if (result.errors > 0) {
      console.log()
      console.log('=== Errors ===')
      const errorResults = result.results.filter((r) => r.status === 'error')
      errorResults.forEach((result) => {
        console.log(`❌ ${result.email}: ${result.error}`)
      })
    }

    // Show duplicates
    if (result.duplicates > 0) {
      console.log()
      console.log('=== Duplicates ===')
      const duplicateResults = result.results.filter(
        (r) => r.status === 'duplicate'
      )
      duplicateResults.forEach((result) => {
        const prefix = dryRun ? '[DRY RUN] Would skip' : '⚠️  Skipped'
        console.log(`${prefix}: ${result.email} (already invited)`)
      })
    }

    if (dryRun) {
      console.log()
      console.log(
        'ℹ️  This was a dry run. No invitations were actually created.'
      )
      console.log('   Remove --dry-run flag to execute the import.')
    } else if (result.created > 0 || result.autoAccepted > 0) {
      console.log()
      if (result.autoAccepted > 0) {
        console.log(
          `✅ Import completed successfully! ${result.created} pending invitations created, ${result.autoAccepted} users auto-enrolled.`
        )
      } else {
        console.log(
          `✅ Import completed successfully! ${result.created} invitations created.`
        )
      }
      console.log(
        '   Pending participants will be automatically enrolled when they log in via eduID.'
      )
      if (result.autoAccepted > 0) {
        console.log(
          '   Auto-enrolled participants can access the course immediately.'
        )
      }
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
