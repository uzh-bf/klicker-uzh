#!/usr/bin/env tsx

import { prisma } from '@klicker-uzh/prisma'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import * as R from 'remeda'
import { createParticipantInvitations } from '../services/participantInvitations.js'

// Configuration - adjust these values as needed
const CSV_FILE = `src/scripts/invitations_${process.env.CONFIG}.csv`

async function run() {
  console.log('=== Participant Invitation Import ===')
  console.log('CSV File:', CSV_FILE)
  console.log()

  try {
    // Read and parse CSV file
    console.log('Reading CSV file...')
    const csvContent = readFileSync(CSV_FILE, 'utf-8')
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    console.log(`Found ${records.length} rows in CSV`)
    console.log()

    // Validate CSV structure
    if (records.length === 0) {
      console.error('CSV file is empty')
      process.exit(1)
    }

    if (!records[0].email || !records[0].courseId) {
      console.error('CSV must have both "email" and "courseId" columns')
      process.exit(1)
    }

    // Group emails by courseId using Remeda
    const validRecords = R.pipe(
      records,
      R.filter((record) => {
        const hasValidData = record.email?.trim() && record.courseId?.trim()
        if (!hasValidData) {
          console.warn(
            `Skipping row with missing email or courseId: ${JSON.stringify(record)}`
          )
        }
        return hasValidData
      }),
      R.map((record) => ({
        email: record.email.trim(),
        courseId: record.courseId.trim(),
      }))
    )

    const groupedByState = R.groupBy(validRecords, R.prop('courseId'))
    const courseGroups = new Map(
      R.pipe(
        groupedByState,
        R.entries,
        R.map(
          ([courseId, records]) =>
            [courseId, records.map((r) => r.email)] as const
        )
      )
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
        const result = await createParticipantInvitations(courseId, emails)

        console.log(`Created (PENDING): ${result.created}`)
        console.log(`Auto-accepted (existing users): ${result.autoAccepted}`)
        console.log(`Skipped (duplicates): ${result.duplicates}`)
        console.log(`Errors: ${result.errors}`)

        // Group results by status for this course
        const resultsByStatus = R.groupBy(result.results, R.prop('status'))

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
        totalCreated += result.created
        totalAutoAccepted += result.autoAccepted
        totalDuplicates += result.duplicates
        totalErrors += result.errors
        totalProcessed += result.totalProcessed
      } catch (error: any) {
        console.error(`Failed to process course ${courseId}: ${error.message}`)
        totalErrors += emails.length
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

// Run the script
run().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
