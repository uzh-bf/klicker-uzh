import { describe, expect, it } from 'vitest'
import { getRuntimeSettings } from '../src/config.js'

describe('lecturer MCP runtime settings', () => {
  it('uses local defaults', () => {
    expect(
      getRuntimeSettings({
        APP_ORIGIN_AUTH: 'https://auth.klicker.test',
        APP_SECRET: 'app-secret',
      })
    ).toEqual({
      host: '0.0.0.0',
      jwtIssuer: 'https://auth.klicker.test',
      jwtSecret: 'app-secret',
      mcpEndpoint: '/mcp',
      port: 7081,
    })
  })

  it('normalizes endpoint paths and numeric ports', () => {
    expect(
      getRuntimeSettings({
        APP_ORIGIN_AUTH: 'https://auth.klicker.test',
        APP_SECRET: 'app-secret',
        MCP_LECTURER_HOST: '127.0.0.1',
        MCP_LECTURER_JWT_SECRET: 'lecturer-secret',
        MCP_LECTURER_PATH: 'lecturer-mcp',
        MCP_LECTURER_PORT: '9081',
      })
    ).toEqual({
      host: '127.0.0.1',
      jwtIssuer: 'https://auth.klicker.test',
      jwtSecret: 'lecturer-secret',
      mcpEndpoint: '/lecturer-mcp',
      port: 9081,
    })
  })

  it('requires JWT signing configuration', () => {
    expect(() => getRuntimeSettings({})).toThrow(
      'APP_SECRET or MCP_LECTURER_JWT_SECRET is required'
    )
    expect(() =>
      getRuntimeSettings({
        APP_SECRET: 'app-secret',
      })
    ).toThrow('APP_ORIGIN_AUTH is required')
  })
})
