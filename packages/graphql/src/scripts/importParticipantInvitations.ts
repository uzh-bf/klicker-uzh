#!/usr/bin/env tsx

import { prisma } from '@klicker-uzh/prisma'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { createParticipantInvitations } from '../services/participantInvitations.js'

// Configuration - adjust these values as needed
const CSV_FILE = 'src/scripts/invitations_dev.csv'

async function run() {
  console.log('=== Participant Invitation Import ===')
  console.log('Course ID:', COURSE_ID)
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

    if (!records[0].email) {
      console.error('CSV must have an "email" column')
      process.exit(1)
    }

    // Extract emails from CSV
    const emails = records.map((record) => record.email).filter(Boolean)

    console.log('Processing invitations...')

    // Create invitations using the service
    const result = await createParticipantInvitations(COURSE_ID, emails)

    console.log()
    console.log('=== Import Results ===')
    console.log(`Total rows processed: ${result.totalProcessed}`)
    console.log(`Successfully created (PENDING): ${result.created}`)
    console.log(`Auto-accepted (existing users): ${result.autoAccepted}`)
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
        console.log(`Auto-accepted: ${result.email} → ${result.participantId}`)
      })
    }

    // Show errors
    if (result.errors > 0) {
      console.log()
      console.log('=== Errors ===')
      const errorResults = result.results.filter((r) => r.status === 'error')
      errorResults.forEach((result) => {
        console.log(`${result.email}: ${result.error}`)
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
        console.log(`Skipped: ${result.email} (already invited)`)
      })
    }

    if (result.created > 0 || result.autoAccepted > 0) {
      console.log()
      if (result.autoAccepted > 0) {
        console.log(
          `Import completed! ${result.created} pending invitations created, ${result.autoAccepted} users auto-enrolled.`
        )
      } else {
        console.log(`Import completed! ${result.created} invitations created.`)
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
