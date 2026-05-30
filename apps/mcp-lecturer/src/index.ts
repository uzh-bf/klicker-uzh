import { getRuntimeSettings } from './config.js'
import { createLecturerMcpServer } from './server.js'

const settings = getRuntimeSettings()
const server = createLecturerMcpServer(settings)

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
