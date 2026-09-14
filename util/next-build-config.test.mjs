import assert from 'node:assert/strict'
import test from 'node:test'
import { getNextBaseConfig } from '../packages/next-config/index.js'

test('Pages Router builds exclude development validators without disabling checks', () => {
  for (const NODE_ENV of ['production', 'test']) {
    const config = getNextBaseConfig({
      buildTsconfigPath: 'tsconfig.check.json',
      NODE_ENV,
    })
    assert.equal(config.typescript.tsconfigPath, 'tsconfig.check.json')
    assert.notEqual(config.typescript.ignoreBuildErrors, true)
  }
})

test('development and App Router keep the default TypeScript config', () => {
  assert.equal(
    getNextBaseConfig({
      buildTsconfigPath: 'tsconfig.check.json',
      NODE_ENV: 'development',
    }).typescript,
    undefined
  )
  assert.equal(
    getNextBaseConfig({ pagesRouterOnly: true, NODE_ENV: 'production' })
      .typescript,
    undefined
  )
  assert.equal(
    getNextBaseConfig({ NODE_ENV: 'production' }).typescript,
    undefined
  )
})
