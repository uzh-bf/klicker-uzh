import assert from 'node:assert/strict'
import test from 'node:test'

import { isTransientDatabaseError } from './migration.js'

test('classifies transient Prisma database failures by code', () => {
  for (const code of ['P1001', 'P1002', 'P1017', 'P2024']) {
    assert.equal(
      isTransientDatabaseError(Object.assign(new Error('failed'), { code })),
      true
    )
  }

  assert.equal(
    isTransientDatabaseError(
      Object.assign(new Error('failed'), { errorCode: 'P1001' })
    ),
    true
  )
})

test('uses message matching only when Prisma supplies no code', () => {
  assert.equal(
    isTransientDatabaseError(new Error('connect ECONNREFUSED 127.0.0.1')),
    true
  )
  assert.equal(
    isTransientDatabaseError(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1'), {
        code: 'ECONNREFUSED',
      })
    ),
    true
  )
  assert.equal(
    isTransientDatabaseError(
      Object.assign(new Error('connection timed out'), { code: 'P2002' })
    ),
    false
  )
  assert.equal(isTransientDatabaseError(new Error('invalid input')), false)
})
