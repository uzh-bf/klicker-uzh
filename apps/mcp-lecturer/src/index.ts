import prisma from '@klicker-uzh/prisma'
import { getRuntimeSettings } from './config.js'
import { createLecturerMcpServer } from './server.js'
import { createLecturerReadService } from './service.js'

const settings = getRuntimeSettings()
const server = createLecturerMcpServer(
  settings,
  createLecturerReadService(prisma)
)

await server.start({
  httpStream: {
    endpoint: settings.mcpEndpoint,
    host: settings.host,
    port: settings.port,
  },
  transportType: 'httpStream',
})

console.log(
  `Lecturer MCP server listening on http://${settings.host}:${settings.port}${settings.mcpEndpoint}`
)

async function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}, shutting down Lecturer MCP server...`)
  let exitCode = 0
  try {
    await server.stop()
  } catch (error) {
    console.error('Error during Lecturer MCP server shutdown:', error)
    exitCode = 1
  } finally {
    process.exit(exitCode)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
