import { describe, expect, it } from 'vitest'
import { getRuntimeSettings } from '../src/config.js'

describe('lecturer MCP runtime settings', () => {
  it('uses local defaults', () => {
    expect(getRuntimeSettings({})).toEqual({
      host: '0.0.0.0',
      mcpEndpoint: '/mcp',
      port: 7081,
    })
  })

  it('normalizes endpoint paths and numeric ports', () => {
    expect(
      getRuntimeSettings({
        MCP_LECTURER_HOST: '127.0.0.1',
        MCP_LECTURER_PATH: 'lecturer-mcp',
        MCP_LECTURER_PORT: '9081',
      })
    ).toEqual({
      host: '127.0.0.1',
      mcpEndpoint: '/lecturer-mcp',
      port: 9081,
    })
  })
})
