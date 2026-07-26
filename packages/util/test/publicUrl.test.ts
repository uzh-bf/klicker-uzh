import { describe, expect, it } from 'vitest'
import { normalizePublicHttpUrl } from '../src/publicUrl.js'

describe('normalizePublicHttpUrl', () => {
  it('normalizes public HTTP and HTTPS URLs', () => {
    expect(normalizePublicHttpUrl(' https://example.com/notes?q=1 ')).toBe(
      'https://example.com/notes?q=1'
    )
    expect(normalizePublicHttpUrl('http://8.8.8.8/resource')).toBe(
      'http://8.8.8.8/resource'
    )
  })

  it.each([
    'ftp://example.com/file',
    'https://user:password@example.com/file',
    'http://localhost:3000/admin',
    'http://metadata/admin',
    'http://service.internal/admin',
    'http://127.0.0.1/admin',
    'http://2130706433/admin',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1/admin',
    'http://172.16.0.1/admin',
    'http://192.168.0.1/admin',
    'http://[::1]/admin',
    'https://content.example.test/file',
  ])('rejects non-public URL %s', (url) => {
    expect(() => normalizePublicHttpUrl(url)).toThrow('URL is invalid')
  })
})
