import { getLecturerMcpUrl } from '@/src/services/lecturerMcp'
import { describe, expect, test } from 'vitest'

describe('lecturer MCP adapter', () => {
  test('prefers the explicit lecturer MCP URL', () => {
    expect(
      getLecturerMcpUrl({
        MCP_LECTURER_URL: 'https://mcp.example.test/lecturer',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv)
    ).toBe('https://mcp.example.test/lecturer')
  })

  test('derives the development MCP URL from lecturer MCP env vars', () => {
    expect(
      getLecturerMcpUrl({
        MCP_LECTURER_PATH: 'custom-mcp',
        MCP_LECTURER_PORT: '7091',
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv)
    ).toBe('http://localhost:7091/custom-mcp')
  })

  test('derives the production MCP URL from lecturer MCP host env vars', () => {
    const url = new URL(
      getLecturerMcpUrl({
        MCP_LECTURER_HOST: 'lecturer-mcp.internal',
        MCP_LECTURER_PATH: 'custom-mcp',
        MCP_LECTURER_PORT: '7091',
        MCP_LECTURER_SCHEME: 'http',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv) ?? ''
    )

    expect(url.protocol).toBe('http:')
    expect(url.host).toBe('lecturer-mcp.internal:7091')
    expect(url.pathname).toBe('/custom-mcp')
  })

  test('stays disabled in production without an explicit URL', () => {
    expect(
      getLecturerMcpUrl({
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv)
    ).toBeNull()
  })
})
