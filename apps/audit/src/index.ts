import { serve } from '@hono/node-server'
import { app, tableClient } from './app.js'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { setupMetrics } from './utils/metrics.js'

async function startServer(): Promise<void> {
  try {
    // Initialize metrics endpoint
    setupMetrics(app)

    // Initialize Azure Table (ensure table exists)
    await tableClient.ensureTable()
    logger.info(
      `Azure Table Storage table '${config.AUDIT_TABLE_NAME}' ensured`
    )

    // Start HTTP server
    serve(
      {
        fetch: app.fetch,
        port: config.PORT,
      },
      (info) => {
        logger.info(
          {
            port: info.port,
            env: config.NODE_ENV,
            tableName: config.AUDIT_TABLE_NAME,
          },
          'Audit service started successfully'
        )

        logger.info(`Server running on http://localhost:${info.port}`)
        logger.info(`Readiness check: http://localhost:${info.port}/ready`)
        logger.info(`Metrics: http://localhost:${info.port}/metrics`)
      }
    )
  } catch (error) {
    logger.fatal(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to start audit service'
    )

    process.exit(1)
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal(
    { error: error.message, stack: error.stack },
    'Uncaught exception'
  )
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection')
  process.exit(1)
})

// Start the server
startServer()
