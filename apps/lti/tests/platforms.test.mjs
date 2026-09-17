import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolvePlatforms } from '../src/platforms.ts'

const primary = {
  NODE_ENV: 'production',
  LTI_URL: 'https://experimental.example',
  LTI_NAME: 'Synthetic OLAT',
  LTI_CLIENT_ID: 'experimental-client',
  LTI_AUTH_ENDPOINT: 'https://experimental.example/lti/auth',
  LTI_TOKEN_ENDPOINT: 'https://experimental.example/lti/token',
  LTI_KEYS_ENDPOINT: 'https://experimental.example/lti/keys',
}
const additional = {
  url: 'https://lms.example',
  name: 'Synthetic LMS',
  clientId: 'lms-client',
  authenticationEndpoint: 'https://lms.example/lti/auth',
  accesstokenEndpoint: 'https://lms.example/lti/token',
  authConfig: { method: 'JWK_SET', key: 'https://lms.example/lti/keys' },
}
const withAdditional = (value) => ({
  ...primary,
  LTI_ADDITIONAL_PLATFORMS: JSON.stringify(value),
})

test('unset and empty additional configuration retain the primary registration', () => {
  assert.deepEqual(
    resolvePlatforms(primary),
    resolvePlatforms(withAdditional([]))
  )
  assert.equal(resolvePlatforms(primary)[0].clientId, primary.LTI_CLIENT_ID)
})
test('distinct issuers retain their own clients and endpoints', () => {
  const platforms = resolvePlatforms(withAdditional([additional]))
  assert.equal(platforms.length, 2)
  assert.equal(platforms[0].url, primary.LTI_URL)
  assert.deepEqual(platforms[1], additional)
})
test('rejects duplicates across primary and additional registrations', () => {
  assert.throws(() =>
    resolvePlatforms(withAdditional(resolvePlatforms(primary)))
  )
  assert.throws(() =>
    resolvePlatforms(withAdditional([additional, additional]))
  )
})
test('allows different clients at one issuer', () => {
  const second = { ...resolvePlatforms(primary)[0], clientId: 'another-client' }
  assert.equal(resolvePlatforms(withAdditional([second])).length, 2)
})
test('rejects malformed configuration before returning any registrations', () => {
  for (const value of [
    null,
    {},
    [null],
    [{ ...additional, clientId: '' }],
    [{ ...additional, authConfig: { method: 'RSA_KEY', key: 'value' } }],
    [{ ...additional, authenticationEndpoint: 'http://lms.example/auth' }],
    [{ ...additional, url: 'https://user:password@lms.example' }],
    [{ ...additional, authConfig: { method: 'JWK_SET', key: 'not-a-url' } }],
  ]) {
    assert.throws(() => resolvePlatforms(withAdditional(value)))
  }
  assert.throws(() =>
    resolvePlatforms({ ...primary, LTI_ADDITIONAL_PLATFORMS: '{' })
  )
  assert.throws(() =>
    resolvePlatforms({ ...primary, LTI_CLIENT_ID: undefined })
  )
})
