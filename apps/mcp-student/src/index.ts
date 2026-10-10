import { getRuntimeSettings } from './config.js'
import { PersistedGraphQLClient } from './graphqlClient.js'
import { createStudentMcpServer } from './server.js'
import { StudentPracticeService } from './service.js'

const settings = getRuntimeSettings()
const graphql = new PersistedGraphQLClient(settings.apiGraphqlEndpoint)
const service = new StudentPracticeService(graphql, {
  secret: settings.questionRefSecret,
  ttlSeconds: settings.questionRefTtlSeconds,
})
const server = createStudentMcpServer(settings, service)

await server.start({
  httpStream: {
    endpoint: settings.mcpEndpoint,
    host: settings.host,
    port: settings.port,
  },
  transportType: 'httpStream',
})

console.log(
  `Student MCP server listening on http://${settings.host}:${settings.port}${settings.mcpEndpoint}`
)

async function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}, shutting down Student MCP server...`)
  let exitCode = 0
  try {
    await server.stop()
  } catch (error) {
    console.error('Error during Student MCP server shutdown:', error)
    exitCode = 1
  } finally {
    process.exit(exitCode)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
