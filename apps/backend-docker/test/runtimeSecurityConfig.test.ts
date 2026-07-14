import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getImportExportManageOriginForStartup,
  shouldMaskGraphqlErrors,
} from '../src/runtimeSecurityConfig.js'

describe('GraphQL error masking', () => {
  it('always masks errors outside an explicit local runtime', () => {
    for (const nodeEnv of [undefined, 'production', 'staging', 'typo']) {
      for (const debug of [undefined, 'true', 'false', 'malformed']) {
        assert.equal(
          shouldMaskGraphqlErrors({ NODE_ENV: nodeEnv, DEBUG: debug }),
          true
        )
      }
    }
  })

  it('only unmasks an exact true value in development or test', () => {
    for (const nodeEnv of ['development', 'test']) {
      assert.equal(shouldMaskGraphqlErrors({ NODE_ENV: nodeEnv }), true)
      assert.equal(
        shouldMaskGraphqlErrors({ NODE_ENV: nodeEnv, DEBUG: 'false' }),
        true
      )
      assert.equal(
        shouldMaskGraphqlErrors({ NODE_ENV: nodeEnv, DEBUG: 'true' }),
        false
      )
      assert.throws(
        () => shouldMaskGraphqlErrors({ NODE_ENV: nodeEnv, DEBUG: '1' }),
        /DEBUG/
      )
    }
  })
})

describe('import/export manage-origin startup configuration', () => {
  it('does not require an origin for dark or assessment responsibilities', () => {
    for (const nodeEnv of ['production', 'test']) {
      assert.equal(
        getImportExportManageOriginForStartup({
          userOperations: false,
          env: { NODE_ENV: nodeEnv, APP_ORIGIN_MANAGE: 'malformed' },
        }),
        undefined
      )
    }
  })

  it('normalizes a canonical enabled origin and permits HTTP only locally', () => {
    assert.equal(
      getImportExportManageOriginForStartup({
        userOperations: true,
        env: {
          NODE_ENV: 'production',
          APP_ORIGIN_MANAGE: 'https://manage.example.test/',
        },
      }),
      'https://manage.example.test'
    )
    assert.equal(
      getImportExportManageOriginForStartup({
        userOperations: true,
        env: {
          NODE_ENV: 'test',
          APP_ORIGIN_MANAGE: 'http://127.0.0.1:3002',
        },
      }),
      'http://127.0.0.1:3002'
    )
    assert.throws(
      () =>
        getImportExportManageOriginForStartup({
          userOperations: true,
          env: {
            NODE_ENV: 'production',
            APP_ORIGIN_MANAGE: 'http://manage.example.test',
          },
        }),
      /HTTPS origin/
    )
  })

  it('rejects missing, credentialed, path, query, fragment, and whitespace origins', () => {
    for (const value of [
      undefined,
      ' https://manage.example.test',
      'https://user@manage.example.test',
      'https://manage.example.test/path',
      'https://manage.example.test?query=1',
      'https://manage.example.test#fragment',
    ]) {
      assert.throws(() =>
        getImportExportManageOriginForStartup({
          userOperations: true,
          env: { NODE_ENV: 'production', APP_ORIGIN_MANAGE: value },
        })
      )
    }
  })
})
