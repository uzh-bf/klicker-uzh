import { TableClient } from '@azure/data-tables'
import { DefaultAzureCredential, type TokenCredential } from '@azure/identity'
import { BlobServiceClient } from '@azure/storage-blob'
import { AUDIT_TABLE_NAMES } from './table-mapping.js'

export const AUDIT_BLOB_CONTAINER_NAMES = {
  manifests: 'audit-manifests',
  media: 'audit-media',
} as const

export type AzureAuditStorageConfig = {
  tableEndpoint: string
  blobEndpoint: string
}

export type AzureAuditClients = {
  tables: {
    evidence: TableClient
    locator: TableClient
    retentionIndex: TableClient
    control: TableClient
  }
  blobs: {
    manifests: ReturnType<BlobServiceClient['getContainerClient']>
    media: ReturnType<BlobServiceClient['getContainerClient']>
  }
}

function validateServiceEndpoint(value: string, service: 'blob' | 'table') {
  const endpoint = new URL(value)
  const isLoopback =
    endpoint.hostname === 'localhost' ||
    endpoint.hostname === '127.0.0.1' ||
    endpoint.hostname === '::1'
  if (endpoint.protocol !== 'https:' && !isLoopback) {
    throw new TypeError(`Assessment audit ${service} endpoint must use HTTPS`)
  }
  if (
    endpoint.username !== '' ||
    endpoint.password !== '' ||
    endpoint.search !== '' ||
    endpoint.hash !== ''
  ) {
    throw new TypeError(
      `Assessment audit ${service} endpoint must not contain credentials or parameters`
    )
  }
  if (endpoint.pathname !== '' && endpoint.pathname !== '/') {
    throw new TypeError(
      `Assessment audit ${service} endpoint must be an account root URL`
    )
  }
  return endpoint.toString().replace(/\/$/, '')
}

function requiredEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string
): string {
  const value = environment[name]?.trim()
  if (value === undefined || value === '') {
    throw new Error(`${name} is required for assessment audit storage`)
  }
  return value
}

export function readAzureAuditStorageConfig(
  environment: NodeJS.ProcessEnv = process.env
): AzureAuditStorageConfig {
  return {
    tableEndpoint: validateServiceEndpoint(
      requiredEnvironmentValue(environment, 'ASSESSMENT_AUDIT_TABLE_ENDPOINT'),
      'table'
    ),
    blobEndpoint: validateServiceEndpoint(
      requiredEnvironmentValue(environment, 'ASSESSMENT_AUDIT_BLOB_ENDPOINT'),
      'blob'
    ),
  }
}

export function createAzureAuditClients(
  config: AzureAuditStorageConfig,
  credential: TokenCredential = createAzureAuditCredential()
): AzureAuditClients {
  const tableEndpoint = validateServiceEndpoint(config.tableEndpoint, 'table')
  const blobEndpoint = validateServiceEndpoint(config.blobEndpoint, 'blob')
  const blobService = new BlobServiceClient(blobEndpoint, credential)

  return {
    tables: {
      evidence: new TableClient(
        tableEndpoint,
        AUDIT_TABLE_NAMES.evidence,
        credential
      ),
      locator: new TableClient(
        tableEndpoint,
        AUDIT_TABLE_NAMES.locator,
        credential
      ),
      retentionIndex: new TableClient(
        tableEndpoint,
        AUDIT_TABLE_NAMES.retentionIndex,
        credential
      ),
      control: new TableClient(
        tableEndpoint,
        AUDIT_TABLE_NAMES.control,
        credential
      ),
    },
    blobs: {
      manifests: blobService.getContainerClient(
        AUDIT_BLOB_CONTAINER_NAMES.manifests
      ),
      media: blobService.getContainerClient(AUDIT_BLOB_CONTAINER_NAMES.media),
    },
  }
}

export function createAzureAuditCredential(): TokenCredential {
  return new DefaultAzureCredential()
}
