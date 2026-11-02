import { describe, expect, it } from 'vitest'
import { getBlobStorageAccountUrl } from '../src/blobStorage.js'

describe('getBlobStorageAccountUrl', () => {
  it('uses the Azure account endpoint by default', () => {
    expect(getBlobStorageAccountUrl('klicker')).toBe(
      'https://klicker.blob.core.windows.net'
    )
  })

  it('accepts and normalizes an emulator endpoint', () => {
    expect(
      getBlobStorageAccountUrl(
        'devstoreaccount1',
        ' https://blob.klicker.localhost/devstoreaccount1/ '
      )
    ).toBe('https://blob.klicker.localhost/devstoreaccount1')
  })

  it.each([
    'not a URL',
    'file:///tmp/blob',
  ])('rejects an invalid account URL: %s', (accountUrl) => {
    expect(() => getBlobStorageAccountUrl('klicker', accountUrl)).toThrow(
      'Blob storage account URL is invalid'
    )
  })
})
