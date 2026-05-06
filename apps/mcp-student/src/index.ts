import { StudentBackend } from './backend.js'
import { getRuntimeSettings } from './config.js'
import { PersistedGraphQLClient } from './graphqlClient.js'
import { createStudentMcpServer } from './server.js'
import { StudentPracticeService } from './service.js'

const settings = getRuntimeSettings()
const graphql = new PersistedGraphQLClient(settings.apiGraphqlEndpoint)
const backend = new StudentBackend(graphql)
const service = new StudentPracticeService(backend, {
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
