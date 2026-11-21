import assert from 'node:assert/strict'
import test from 'node:test'
import { enableCoverageMaps } from '../../apps/auth/browser-coverage.config.mjs'

const valid = {
  KLICKER_BROWSER_COVERAGE: '1',
  GITHUB_ACTIONS: 'true',
  CI: 'true',
  NODE_ENV: 'production',
  KLICKER_PLAYWRIGHT_FIXTURES: '1',
}

test('default production and existing staging configuration stay unchanged', () => {
  for (const productionBrowserSourceMaps of [false, true]) {
    const config = { productionBrowserSourceMaps }
    assert.equal(enableCoverageMaps(config, {}), config)
  }
})
test('only the explicit synthetic CI production build enables maps', () => {
  assert.equal(
    enableCoverageMaps({ productionBrowserSourceMaps: false }, valid)
      .productionBrowserSourceMaps,
    true
  )
  for (const key of Object.keys(valid)) {
    if (key === 'KLICKER_BROWSER_COVERAGE') continue
    assert.throws(
      () => enableCoverageMaps({}, { ...valid, [key]: '' }),
      /synthetic production CI/
    )
  }
  assert.throws(
    () => enableCoverageMaps({}, { ...valid, KLICKER_BROWSER_COVERAGE: 'yes' }),
    /synthetic production CI/
  )
})
