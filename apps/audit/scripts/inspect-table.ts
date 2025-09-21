#!/usr/bin/env tsx

import { AzureNamedKeyCredential, TableClient } from '@azure/data-tables'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'

// Load test environment variables
dotenvConfig({ path: resolve(process.cwd(), '.env.test') })

interface AuditEvent {
  partitionKey: string
  rowKey: string
  timestamp?: number
  subject?: string
  action?: string
  resourceId?: string
  sessionId?: string
  userId?: string
  attributes?: string
  etag: string
}

class TableInspector {
  private tableClient: TableClient

  constructor() {
    const connectionString = process.env.AUDIT_TABLE_CONNECTION_STRING
    const tableName = process.env.AUDIT_TABLE_NAME || 'auditevents'

    if (!connectionString) {
      throw new Error(
        'AUDIT_TABLE_CONNECTION_STRING environment variable is required'
      )
    }

    // Handle Azurite connection string format (same as service)
    if (connectionString.includes('TableEndpoint=')) {
      // Parse connection string format for Azurite compatibility
      const parts = connectionString.split(';').reduce(
        (acc, part) => {
          const [key, value] = part.split('=', 2)
          if (key && value) acc[key] = value
          return acc
        },
        {} as Record<string, string>
      )

      const accountUrl = parts.TableEndpoint
      const accountName = parts.AccountName
      const accountKey = parts.AccountKey

      if (!accountUrl || !accountName || !accountKey) {
        throw new Error('Invalid connection string format')
      }

      const credential = new AzureNamedKeyCredential(accountName, accountKey)
      this.tableClient = new TableClient(accountUrl, tableName, credential, {
        allowInsecureConnection: accountUrl.startsWith('http:'), // Allow HTTP for Azurite
      })
    } else {
      // Fallback to direct connection string (for production Azure)
      this.tableClient = new TableClient(connectionString, tableName)
    }
  }

  async listAllEvents(): Promise<AuditEvent[]> {
    const entities: AuditEvent[] = []

    console.log('📋 Fetching all audit events from table storage...\n')

    try {
      for await (const entity of this.tableClient.listEntities<AuditEvent>()) {
        entities.push(entity)
      }
    } catch (error) {
      console.error('❌ Error fetching entities:', error)
      throw error
    }

    return entities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }

  async getEventsByPartition(partitionKey: string): Promise<AuditEvent[]> {
    const entities: AuditEvent[] = []

    console.log(`📋 Fetching events for partition: ${partitionKey}\n`)

    try {
      for await (const entity of this.tableClient.listEntities<AuditEvent>({
        queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
      })) {
        entities.push(entity)
      }
    } catch (error) {
      console.error('❌ Error fetching entities:', error)
      throw error
    }

    return entities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }

  async getEventsBySubject(subject: string): Promise<AuditEvent[]> {
    const entities: AuditEvent[] = []

    console.log(`📋 Fetching events for subject: ${subject}\n`)

    try {
      for await (const entity of this.tableClient.listEntities<AuditEvent>({
        queryOptions: { filter: `subject eq '${subject}'` },
      })) {
        entities.push(entity)
      }
    } catch (error) {
      console.error('❌ Error fetching entities:', error)
      throw error
    }

    return entities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }

  async getEventsByAction(action: string): Promise<AuditEvent[]> {
    const entities: AuditEvent[] = []

    console.log(`📋 Fetching events for action: ${action}\n`)

    try {
      for await (const entity of this.tableClient.listEntities<AuditEvent>({
        queryOptions: { filter: `action eq '${action}'` },
      })) {
        entities.push(entity)
      }
    } catch (error) {
      console.error('❌ Error fetching entities:', error)
      throw error
    }

    return entities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }

  async getRecentEvents(hours: number = 1): Promise<AuditEvent[]> {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000
    const entities: AuditEvent[] = []

    console.log(`📋 Fetching events from the last ${hours} hour(s)...\n`)

    try {
      for await (const entity of this.tableClient.listEntities<AuditEvent>({
        queryOptions: { filter: `timestamp ge ${cutoffTime}` },
      })) {
        entities.push(entity)
      }
    } catch (error) {
      console.error('❌ Error fetching entities:', error)
      throw error
    }

    return entities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }

  displayEvents(events: AuditEvent[], limit?: number): void {
    const eventsToShow = limit ? events.slice(0, limit) : events

    if (eventsToShow.length === 0) {
      console.log('📭 No events found matching the criteria')
      return
    }

    console.log(
      `📊 Found ${events.length} event(s)${limit ? ` (showing first ${eventsToShow.length})` : ''}:\n`
    )

    eventsToShow.forEach((event, index) => {
      const timestamp = event.timestamp
        ? new Date(event.timestamp).toISOString()
        : 'N/A'
      const attributes = event.attributes ? JSON.parse(event.attributes) : null

      console.log(`🔍 Event #${index + 1}`)
      console.log(`   Event ID: ${event.rowKey}`)
      console.log(`   Partition: ${event.partitionKey}`)
      console.log(`   Timestamp: ${timestamp}`)
      console.log(`   Subject: ${event.subject || 'N/A'}`)
      console.log(`   Action: ${event.action || 'N/A'}`)

      if (event.resourceId) console.log(`   Resource ID: ${event.resourceId}`)
      if (event.sessionId) console.log(`   Session ID: ${event.sessionId}`)
      if (event.userId) console.log(`   User ID: ${event.userId}`)

      if (attributes) {
        console.log(`   Attributes:`)
        console.log(
          `   ${JSON.stringify(attributes, null, 4).replace(/\n/g, '\n   ')}`
        )
      }

      console.log() // Empty line for readability
    })
  }

  async getPartitionSummary(): Promise<void> {
    console.log('📊 Analyzing partition distribution...\n')

    const partitionCounts: Record<string, number> = {}

    try {
      for await (const entity of this.tableClient.listEntities<AuditEvent>()) {
        partitionCounts[entity.partitionKey] =
          (partitionCounts[entity.partitionKey] || 0) + 1
      }
    } catch (error) {
      console.error('❌ Error analyzing partitions:', error)
      return
    }

    const sortedPartitions = Object.entries(partitionCounts).sort(
      ([, a], [, b]) => b - a
    )

    console.log(
      `📈 Partition Summary (${sortedPartitions.length} partitions):\n`
    )

    sortedPartitions.forEach(([partition, count]) => {
      console.log(`   ${partition}: ${count} event(s)`)
    })

    console.log(
      `\n📊 Total Events: ${Object.values(partitionCounts).reduce((sum, count) => sum + count, 0)}`
    )
  }

  async clearAllEvents(): Promise<void> {
    console.log('🧹 Clearing all audit events...\n')

    const entities: AuditEvent[] = []

    try {
      for await (const entity of this.tableClient.listEntities<AuditEvent>()) {
        entities.push(entity)
      }

      if (entities.length === 0) {
        console.log('📭 No events to clear')
        return
      }

      console.log(`🗑️ Deleting ${entities.length} event(s)...`)

      for (const entity of entities) {
        await this.tableClient.deleteEntity(entity.partitionKey, entity.rowKey)
      }

      console.log('✅ All events cleared successfully')
    } catch (error) {
      console.error('❌ Error clearing events:', error)
      throw error
    }
  }
}

async function main(): Promise<void> {
  const inspector = new TableInspector()
  const args = process.argv.slice(2)
  const command = args[0]

  try {
    switch (command) {
      case 'list':
      case 'all':
        const limit = args[1] ? parseInt(args[1]) : undefined
        const allEvents = await inspector.listAllEvents()
        inspector.displayEvents(allEvents, limit)
        break

      case 'partition':
        if (!args[1]) {
          console.error(
            '❌ Please provide a partition key: npm run inspect:table partition <partition-key>'
          )
          process.exit(1)
        }
        const partitionEvents = await inspector.getEventsByPartition(args[1])
        inspector.displayEvents(partitionEvents)
        break

      case 'subject':
        if (!args[1]) {
          console.error(
            '❌ Please provide a subject: npm run inspect:table subject <subject>'
          )
          process.exit(1)
        }
        const subjectEvents = await inspector.getEventsBySubject(args[1])
        inspector.displayEvents(subjectEvents)
        break

      case 'action':
        if (!args[1]) {
          console.error(
            '❌ Please provide an action: npm run inspect:table action <action>'
          )
          process.exit(1)
        }
        const actionEvents = await inspector.getEventsByAction(args[1])
        inspector.displayEvents(actionEvents)
        break

      case 'recent':
        const hours = args[1] ? parseInt(args[1]) : 1
        const recentEvents = await inspector.getRecentEvents(hours)
        inspector.displayEvents(recentEvents)
        break

      case 'summary':
      case 'partitions':
        await inspector.getPartitionSummary()
        break

      case 'clear':
        if (args[1] !== '--confirm') {
          console.log('⚠️ This will delete ALL audit events from the table.')
          console.log('To confirm, run: npm run inspect:table clear --confirm')
          process.exit(0)
        }
        await inspector.clearAllEvents()
        break

      default:
        console.log(`
🔍 Azure Table Storage Inspector for Audit Events

Usage: npm run inspect:table <command> [options]

Commands:
  list [limit]              List all events (optionally limit results)
  partition <key>           List events in specific partition
  subject <subject>         List events for specific subject
  action <action>           List events for specific action
  recent [hours]            List events from last N hours (default: 1)
  summary                   Show partition distribution summary
  clear --confirm           Delete all events (requires --confirm)

Examples:
  npm run inspect:table list 10
  npm run inspect:table partition "2025-01-13T22-0"
  npm run inspect:table subject "user:test@example.com"
  npm run inspect:table action "login.success"
  npm run inspect:table recent 24
  npm run inspect:table summary
  npm run inspect:table clear --confirm
        `)
        break
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unhandled error:', error)
  process.exit(1)
})
