import type { TokenCredential } from '@azure/identity'
import {
  createAzureAuditClients,
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
