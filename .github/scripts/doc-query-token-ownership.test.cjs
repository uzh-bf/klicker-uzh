'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const {
  attributeDivergence,
  evaluateOwnership,
} = require('./doc-query-token-ownership.cjs')

const PACKAGE_MODULE = '@klicker-uzh/doc-query-client'

const RE_EXPORT = [
  'export {',
  '  createDocQueryScopedFetch,',
  '  DocQueryScopeTokenError,',
  '  signDocQueryScopeToken,',
  "} from '" + PACKAGE_MODULE + "'",
  '',
].join('\n')

// The shape this gate exists to prevent: the module signs the token itself, so
// the package token keeps its tests without reaching the transport.
const APP_LOCAL = [
  "import { randomUUID } from 'node:crypto'",
  "import { importPKCS8, SignJWT } from 'jose'",
  '',
  "const ALGORITHM = 'ES256'",
  '',
  'export async function signDocQueryScopeToken(options) {',
  '  return importPKCS8(options.privateKey, ALGORITHM)',
  '}',
  '',
].join('\n')

const kindsOf = (reasons) => reasons.map((reason) => reason.kind)

const detailsOf = (reasons) => reasons.map((reason) => reason.detail)

describe('doc query token ownership on v3-ai', () => {
  it('accepts the package re-export', () => {
    assert.deepEqual(evaluateOwnership(RE_EXPORT), { ok: true, reasons: [] })
  })

  it('accepts a star re-export of the package', () => {
    const text = "export * from '" + PACKAGE_MODULE + "'\n"
    assert.deepEqual(evaluateOwnership(text), { ok: true, reasons: [] })
  })

  it('accepts the re-export with surrounding comments', () => {
    const text = '// the package owns the signer\n' + RE_EXPORT + '/* end */\n'
    assert.deepEqual(evaluateOwnership(text), { ok: true, reasons: [] })
  })

  it('fails on an app-local implementation', () => {
    const { ok, reasons } = evaluateOwnership(APP_LOCAL)
    assert.equal(ok, false)
    assert.equal(reasons[0].kind, 'local-code')
    assert.equal(kindsOf(reasons).includes('missing-export'), true)
  })

  it('fails when the re-export drops a required export', () => {
    const text = [
      'export {',
      '  createDocQueryScopedFetch,',
      "} from '" + PACKAGE_MODULE + "'",
      '',
    ].join('\n')
    const { ok, reasons } = evaluateOwnership(text)
    assert.equal(ok, false)
    assert.deepEqual(kindsOf(reasons), ['missing-export', 'missing-export'])
    assert.deepEqual(detailsOf(reasons), [
      'DocQueryScopeTokenError',
      'signDocQueryScopeToken',
    ])
  })

  it('fails when the re-export names another module', () => {
    const text = "export * from '@klicker-uzh/other-client'\n"
    const { ok, reasons } = evaluateOwnership(text)
    assert.equal(ok, false)
    assert.equal(reasons[0].kind, 'foreign-module')
    assert.equal(reasons[0].detail, '@klicker-uzh/other-client')
  })

  it('fails on a missing module', () => {
    assert.deepEqual(kindsOf(evaluateOwnership(undefined).reasons), [
      'missing-module',
    ])
    assert.deepEqual(kindsOf(evaluateOwnership('   \n').reasons), [
      'missing-module',
    ])
  })

  it('blames only a change that edits the guarded paths', () => {
    assert.deepEqual(attributeDivergence(true), {
      blocking: true,
      preexisting: false,
    })
    assert.deepEqual(attributeDivergence(false), {
      blocking: false,
      preexisting: true,
    })
  })
})
