import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getNextBaseConfig } from '../packages/next-config/index.js'

test('only explicitly Pages Router development apps disable the cross-router filter', () => {
  for (const NODE_ENV of ['development', 'production', 'test', undefined]) {
    for (const pagesRouterOnly of [true, false, undefined]) {
      const config = getNextBaseConfig({ NODE_ENV, pagesRouterOnly })
      assert.equal(
        config.experimental?.clientRouterFilter,
        NODE_ENV === 'development' && pagesRouterOnly === true
          ? false
          : undefined,
        JSON.stringify({ NODE_ENV, pagesRouterOnly })
      )
    }
  }
})
