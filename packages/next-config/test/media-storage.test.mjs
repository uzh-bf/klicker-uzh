import assert from 'node:assert/strict'
import { test } from 'node:test'
import matcher from 'next/dist/shared/lib/match-remote-pattern.js'
import { getNextBaseConfig } from '../index.js'

function config(publicUrl, nodeEnv = 'production') {
  return getNextBaseConfig({
    MEDIA_STORAGE_PUBLIC_URL: publicUrl,
    NODE_ENV: nodeEnv,
  })
}

test('allows only configured media host, port and path while retaining Azure patterns', () => {
  const patterns = config('https://cdn.example.test:8443/media/').images
    .remotePatterns
  assert.deepEqual(patterns[0], {
    protocol: 'https',
    hostname: 'cdn.example.test',
    port: '8443',
    pathname: '/media/**',
    search: '',
  })
  assert.ok(
    patterns.some(
      ({ hostname }) =>
        hostname === 'klickeruzhprodimages.blob.core.windows.net'
    )
  )
})

test('keeps existing defaults when no public media URL is configured', () => {
  assert.ok(config('').images.remotePatterns.length > 0)
})

test('accepts loopback HTTP only for development', () => {
  assert.equal(
    config('http://media.klicker.localhost:9000/media', 'development').images
      .remotePatterns[0].protocol,
    'http'
  )
  assert.throws(
    () => config('http://media.klicker.localhost:9000/media'),
    /MEDIA_STORAGE_PUBLIC_URL/
  )
})

test('rejects malformed, unsafe and overbroad URL patterns', () => {
  for (const url of [
    'invalid',
    'http://example.test',
    'https://user:password@example.test',
    'https://example.test?token=secret',
    'https://example.test#fragment',
    'https://example.test/*',
    'https://*.example.test/media',
    'https://example.test/!(private)',
    'https://example.test/a[bc]',
    'https://example.test/{a,b}',
    'https://example.test/+(public)',
  ]) {
    assert.throws(() => config(url), /MEDIA_STORAGE_PUBLIC_URL/)
  }
})

test('fails an explicitly S3-configured build without a public image base', () => {
  assert.throws(
    () =>
      getNextBaseConfig({
        MEDIA_STORAGE_PROVIDER: 's3',
        MEDIA_STORAGE_PUBLIC_URL: '',
        NODE_ENV: 'production',
      }),
    /MEDIA_STORAGE_PUBLIC_URL is required/
  )
})

test('installed Next matcher keeps the configured literal prefix and IPv6 host exact', () => {
  const pattern = config('https://cdn.example.test/assets').images
    .remotePatterns[0]
  assert.equal(
    matcher.matchRemotePattern(
      pattern,
      new URL('https://cdn.example.test/assets/image.png')
    ),
    true
  )
  assert.equal(
    matcher.matchRemotePattern(
      pattern,
      new URL('https://cdn.example.test/unrelated/image.png')
    ),
    false
  )
  const ipv6 = config('http://[::1]:9000/media', 'development').images
    .remotePatterns[0]
  assert.equal(
    matcher.matchRemotePattern(
      ipv6,
      new URL('http://[::1]:9000/media/image.png')
    ),
    true
  )
})
