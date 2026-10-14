import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from 'yaml'

function render(values = []) {
  return parse(
    execFileSync(
      'helm',
      [
        'template',
        'media-storage-test',
        'deploy/charts/klicker-uzh-v3',
        '--show-only',
        'templates/cm-backend-graphql.yaml',
        ...values.flatMap((value) => ['--set', value]),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
  )
}

const s3 = [
  'mediaStorage.provider=s3',
  'mediaStorage.publicUrl=https://media.example.test',
  'mediaStorage.s3.bucket=synthetic-media',
  'mediaStorage.s3.region=us-east-1',
]

test('all shared-Next images accept public media build inputs without AWS credentials', () => {
  for (const app of [
    'frontend-manage',
    'frontend-pwa',
    'frontend-control',
    'chat',
    'auth',
  ]) {
    const dockerfile = readFileSync(`apps/${app}/Dockerfile`, 'utf8')
    const installer = dockerfile
      .split('FROM base AS installer')[1]
      .split('\nFROM ')[0]
    const buildInputs = installer.split('RUN pnpm run build')[0]
    assert.match(buildInputs, /^ARG MEDIA_STORAGE_PROVIDER=azure$/m)
    assert.match(buildInputs, /^ARG MEDIA_STORAGE_PUBLIC_URL$/m)
    assert.doesNotMatch(dockerfile, /^(ARG|ENV) AWS_/m)
  }
})

test('legacy chart values keep Azure as the media default', () => {
  const map = render()
  assert.equal(map.data.MEDIA_STORAGE_PROVIDER, 'azure')
  assert.equal(map.metadata.MEDIA_STORAGE_PROVIDER, undefined)
  assert.equal(map.data.MEDIA_S3_BUCKET, undefined)
})

test('S3 configuration lands in backend ConfigMap data, never metadata or credentials', () => {
  const map = render([
    ...s3,
    'mediaStorage.s3.endpoint=https://objects.example.test',
    'mediaStorage.s3.forcePathStyle=true',
  ])
  assert.equal(map.data.MEDIA_STORAGE_PROVIDER, 's3')
  assert.equal(map.data.MEDIA_STORAGE_PUBLIC_URL, 'https://media.example.test')
  assert.equal(map.data.MEDIA_S3_BUCKET, 'synthetic-media')
  assert.equal(map.data.MEDIA_S3_REGION, 'us-east-1')
  assert.equal(map.data.MEDIA_S3_ENDPOINT, 'https://objects.example.test')
  assert.equal(map.data.MEDIA_S3_FORCE_PATH_STYLE, 'true')
  assert.equal(map.metadata.MEDIA_STORAGE_PROVIDER, undefined)
  assert.equal(map.data.AWS_SECRET_ACCESS_KEY, undefined)
  assert.equal(map.data.AWS_ACCESS_KEY_ID, undefined)
})

test('chart rejects unknown providers and incomplete S3 config', () => {
  assert.throws(
    () => render(['mediaStorage.provider=typo']),
    /provider must be azure or s3/
  )
  for (const missing of ['publicUrl', 's3.bucket', 's3.region']) {
    assert.throws(
      () =>
        render(
          s3.filter((value) => !value.startsWith(`mediaStorage.${missing}=`))
        ),
      /required for S3/
    )
  }
})
