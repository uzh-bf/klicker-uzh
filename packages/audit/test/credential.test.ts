import type { TokenCredential } from '@azure/identity'
import {
  createAzureAuditClients,
  readAuditMediaSourceHosts,
  readAzureAuditStorageConfig,
} from '../src/index.js'

const credential: TokenCredential = {
  getToken: async () => ({
    token: 'synthetic',
    expiresOnTimestamp: Date.now(),
  }),
}

describe('Azure audit credentials', () => {
  it('constructs endpoint-only clients without storage keys', () => {
    const clients = createAzureAuditClients(
      {
        tableEndpoint: 'https://example.table.core.windows.net',
        blobEndpoint: 'https://example.blob.core.windows.net',
      },
      credential
    )

    expect(clients.tables.evidence.tableName).toBe('AuditEvidence')
    expect(clients.tables.control.tableName).toBe('AuditControl')
    expect(clients.blobs.media.containerName).toBe('audit-media')
  })

  it('rejects insecure or credential-bearing production endpoints', () => {
    expect(() =>
      readAzureAuditStorageConfig({
        ASSESSMENT_AUDIT_TABLE_ENDPOINT:
          'http://example.table.core.windows.net',
        ASSESSMENT_AUDIT_BLOB_ENDPOINT: 'https://example.blob.core.windows.net',
      })
    ).toThrow('must use HTTPS')
    expect(() =>
      readAzureAuditStorageConfig({
        ASSESSMENT_AUDIT_TABLE_ENDPOINT:
          'https://key@example.table.core.windows.net',
        ASSESSMENT_AUDIT_BLOB_ENDPOINT: 'https://example.blob.core.windows.net',
      })
    ).toThrow('must not contain credentials')
  })
})

describe('audit media source accounts', () => {
  it('defaults to the primary account and deduplicates explicitly trusted accounts', () => {
    expect(
      readAuditMediaSourceHosts({ BLOB_STORAGE_ACCOUNT_NAME: 'primarymedia' })
    ).toEqual(['primarymedia.blob.core.windows.net'])
    expect(
      readAuditMediaSourceHosts({
        BLOB_STORAGE_ACCOUNT_NAME: 'primarymedia',
        ASSESSMENT_AUDIT_ADDITIONAL_SOURCE_ACCOUNTS:
          ' copiedmedia, primarymedia, copiedmedia ',
      })
    ).toEqual([
      'primarymedia.blob.core.windows.net',
      'copiedmedia.blob.core.windows.net',
    ])
  })

  it.each([
    '*',
    '*.blob.core.windows.net',
    'https://copiedmedia.blob.core.windows.net',
    'copiedmedia/path',
    '127.0.0.1',
    'media@evil',
    'CAPITAL',
    'ab',
    'a'.repeat(25),
  ])('rejects an invalid additional account: %s', (account) => {
    expect(() =>
      readAuditMediaSourceHosts({
        BLOB_STORAGE_ACCOUNT_NAME: 'primarymedia',
        ASSESSMENT_AUDIT_ADDITIONAL_SOURCE_ACCOUNTS: account,
      })
    ).toThrow('storage account names')
  })

  it('requires a valid primary account even when additional accounts are configured', () => {
    expect(() =>
      readAuditMediaSourceHosts({
        ASSESSMENT_AUDIT_ADDITIONAL_SOURCE_ACCOUNTS: 'copiedmedia',
      })
    ).toThrow('BLOB_STORAGE_ACCOUNT_NAME is required')
    expect(() =>
      readAuditMediaSourceHosts({ BLOB_STORAGE_ACCOUNT_NAME: '*' })
    ).toThrow('storage account names')
  })
})
