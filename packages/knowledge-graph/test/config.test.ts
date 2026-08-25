import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KNOWLEDGE_GRAPH_QUERY_TIMEOUT_MS,
  KNOWLEDGE_GRAPH_NEIGHBOR_EDGE_LIMIT,
  KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT,
  KNOWLEDGE_GRAPH_OVERVIEW_EDGE_LIMIT,
  KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT,
  KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT,
  getKnowledgeGraphConfig,
} from '../src/config.js'

const validEnv = {
  KB_FALKORDB_HOST: 'falkordb.ingestion.svc.cluster.local',
  KB_FALKORDB_PORT: '6379',
}

describe('getKnowledgeGraphConfig', () => {
  it('parses the required connection settings and applies safe defaults', () => {
    expect(
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_TLS: 'true',
      })
    ).toEqual({
      host: 'falkordb.ingestion.svc.cluster.local',
      port: 6379,
      username: undefined,
      password: undefined,
      tls: true,
      queryTimeoutMs: 5000,
    })
  })

  it('preserves optional credentials without requiring them', () => {
    expect(
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_USERNAME: 'graph-reader',
        KB_FALKORDB_PASSWORD: 'secret-value',
      })
    ).toMatchObject({
      username: 'graph-reader',
      password: 'secret-value',
      tls: false,
    })
  })

  it.each([undefined, '', '   '])('rejects a missing host (%s)', (host) => {
    expect(() =>
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_HOST: host,
      })
    ).toThrow('KB_FALKORDB_HOST')
  })

  it.each([
    undefined,
    '',
    '0',
    '-1',
    '1.5',
    '65536',
    'not-a-port',
  ])('rejects an invalid port (%s)', (port) => {
    expect(() =>
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_PORT: port,
      })
    ).toThrow('KB_FALKORDB_PORT')
  })

  it.each([
    'TRUE',
    '1',
    'yes',
    ' false ',
  ])('rejects a non-strict TLS value (%s)', (tls) => {
    expect(() =>
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_TLS: tls,
      })
    ).toThrow('KB_FALKORDB_TLS')
  })

  it('accepts an explicit false TLS value', () => {
    expect(
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_TLS: 'false',
      }).tls
    ).toBe(false)
  })

  it('parses a positive safe integer query timeout', () => {
    expect(
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_QUERY_TIMEOUT_MS: '12000',
      }).queryTimeoutMs
    ).toBe(12000)
  })

  it.each([
    '',
    '0',
    '-1',
    '1.5',
    'not-a-timeout',
    '9007199254740992',
  ])('rejects an invalid or unsafe query timeout (%s)', (queryTimeoutMs) => {
    expect(() =>
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_QUERY_TIMEOUT_MS: queryTimeoutMs,
      })
    ).toThrow('KB_FALKORDB_QUERY_TIMEOUT_MS')
  })

  it('does not expose credentials in validation errors', () => {
    const username = 'sensitive-user'
    const password = 'sensitive-password'
    let thrown: unknown

    try {
      getKnowledgeGraphConfig({
        ...validEnv,
        KB_FALKORDB_PORT: 'invalid',
        KB_FALKORDB_USERNAME: username,
        KB_FALKORDB_PASSWORD: password,
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    const message = (thrown as Error).message
    expect(message).not.toContain(username)
    expect(message).not.toContain(password)
  })
})

describe('knowledge graph limits', () => {
  it('exports the approved bounded response defaults', () => {
    expect(DEFAULT_KNOWLEDGE_GRAPH_QUERY_TIMEOUT_MS).toBe(5000)
    expect(KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT).toBe(250)
    expect(KNOWLEDGE_GRAPH_OVERVIEW_EDGE_LIMIT).toBe(500)
    expect(KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT).toBe(20)
    expect(KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT).toBe(100)
    expect(KNOWLEDGE_GRAPH_NEIGHBOR_EDGE_LIMIT).toBe(200)
  })
})
