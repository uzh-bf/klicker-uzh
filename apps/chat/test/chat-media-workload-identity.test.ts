import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  chatMediaWorkloadIdentityStorageConfigured,
  createChatMediaWorkloadIdentityBlobClient,
  resolveChatMediaWorkloadIdentityStorage,
} from '../src/lib/server/chatMediaWorkloadIdentity'

afterEach(() => vi.unstubAllEnvs())

describe('chat media workload identity storage', () => {
  it('leaves storage selection unchanged when the explicit mode is off', () => {
    expect(
      resolveChatMediaWorkloadIdentityStorage(
        {
          COURSE_IMAGE_PROJECTION_STORAGE_ACCOUNT_NAME: 'syntheticacct',
          COURSE_IMAGE_PROJECTION_STORAGE_CONTAINER: 'course-images',
        },
        'COURSE_IMAGE_PROJECTION_STORAGE_ACCOUNT_NAME',
        'course-images'
      )
    ).toBeUndefined()
  })

  it('uses the validated account for the Azure public cloud Blob host', () => {
    expect(
      resolveChatMediaWorkloadIdentityStorage(
        {
          CHAT_MEDIA_WORKLOAD_IDENTITY_ENABLED: 'true',
          AZURE_CLIENT_ID: 'synthetic-client',
          AZURE_TENANT_ID: 'synthetic-tenant',
          AZURE_FEDERATED_TOKEN_FILE: '/tmp/synthetic-token',
          COURSE_IMAGE_PROJECTION_STORAGE_ACCOUNT_NAME: 'syntheticacct',
          BLOB_STORAGE_ACCOUNT_URL: 'https://redirected.example',
        },
        'COURSE_IMAGE_PROJECTION_STORAGE_ACCOUNT_NAME',
        ' course-images '
      )
    ).toEqual({
      accountName: 'syntheticacct',
      container: 'course-images',
    })
  })

  it.each([
    ['missing', undefined, 'course-images'],
    ['malformed', 'Synthetic-Account', 'course-images'],
    ['too short', 'ab', 'course-images'],
    ['missing container', 'syntheticacct', undefined],
    ['blank container', 'syntheticacct', '  '],
    ['invalid container', 'syntheticacct', 'course--images'],
  ])('fails closed for %s workload identity configuration', (_, account, container) => {
    const env = {
      CHAT_MEDIA_WORKLOAD_IDENTITY_ENABLED: 'true',
      AZURE_CLIENT_ID: 'synthetic-client',
      AZURE_TENANT_ID: 'synthetic-tenant',
      AZURE_FEDERATED_TOKEN_FILE: '/tmp/synthetic-token',
      COURSE_IMAGE_PROJECTION_STORAGE_ACCOUNT_NAME: account,
    }
    expect(() =>
      resolveChatMediaWorkloadIdentityStorage(
        env,
        'COURSE_IMAGE_PROJECTION_STORAGE_ACCOUNT_NAME',
        container
      )
    ).toThrow('unavailable')
    expect(
      chatMediaWorkloadIdentityStorageConfigured(
        env,
        'COURSE_IMAGE_PROJECTION_STORAGE_ACCOUNT_NAME',
        container
      )
    ).toBe(false)
  })

  it.each([
    'AZURE_CLIENT_ID',
    'AZURE_TENANT_ID',
    'AZURE_FEDERATED_TOKEN_FILE',
  ])('keeps media disabled without %s', (missing) => {
    const env = {
      CHAT_MEDIA_WORKLOAD_IDENTITY_ENABLED: 'true',
      AZURE_CLIENT_ID: 'synthetic-client',
      AZURE_TENANT_ID: 'synthetic-tenant',
      AZURE_FEDERATED_TOKEN_FILE: '/tmp/synthetic-token',
      BLOB_STORAGE_ACCOUNT_NAME: 'syntheticacct',
      [missing]: '',
    }
    expect(
      chatMediaWorkloadIdentityStorageConfigured(
        env,
        'BLOB_STORAGE_ACCOUNT_NAME',
        'course-images'
      )
    ).toBe(false)
  })

  it('constructs a real Blob client from the workload credential without a token request', () => {
    vi.stubEnv('AZURE_CLIENT_ID', '00000000-0000-0000-0000-000000000001')
    vi.stubEnv('AZURE_TENANT_ID', '00000000-0000-0000-0000-000000000002')
    vi.stubEnv('AZURE_FEDERATED_TOKEN_FILE', '/tmp/synthetic-token')
    vi.stubEnv('BLOB_STORAGE_ACCOUNT_URL', 'https://redirected.example')

    const client = createChatMediaWorkloadIdentityBlobClient('syntheticacct')

    expect(client.url).toBe('https://syntheticacct.blob.core.windows.net/')
    expect(createChatMediaWorkloadIdentityBlobClient('syntheticacct')).toBe(
      client
    )
  })

  it('bounds the client cache while retaining recently used clients', () => {
    vi.stubEnv('AZURE_CLIENT_ID', '00000000-0000-0000-0000-000000000001')
    vi.stubEnv('AZURE_TENANT_ID', '00000000-0000-0000-0000-000000000002')
    vi.stubEnv('AZURE_FEDERATED_TOKEN_FILE', '/tmp/synthetic-token')

    const first = createChatMediaWorkloadIdentityBlobClient('boundacct0')
    for (let index = 1; index <= 8; index++)
      createChatMediaWorkloadIdentityBlobClient(`boundacct${index}`)

    expect(createChatMediaWorkloadIdentityBlobClient('boundacct0')).not.toBe(
      first
    )
  })
})
