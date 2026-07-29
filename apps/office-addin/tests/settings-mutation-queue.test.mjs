import assert from 'node:assert/strict'
import test from 'node:test'

import { createSettingsMutationQueue } from '../src/content/settings-mutation-queue.ts'

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve))
}

test('serializes settings mutations and their saves', async () => {
  const events = []
  const saveResolvers = []
  const persist = createSettingsMutationQueue(
    () =>
      new Promise((resolve) => {
        saveResolvers.push(resolve)
      })
  )

  const first = persist(
    () => events.push('mutate first'),
    () => events.push('rollback first')
  )
  const second = persist(
    () => events.push('mutate second'),
    () => events.push('rollback second')
  )

  await nextTurn()
  assert.deepEqual(events, ['mutate first'])

  saveResolvers.shift()(true)
  assert.equal(await first, 'saved')
  await nextTurn()
  assert.deepEqual(events, ['mutate first', 'mutate second'])

  saveResolvers.shift()(true)
  assert.equal(await second, 'saved')
})

test('persists rollback after a failed settings save', async () => {
  const events = []
  const saveResults = [false, true]
  const persist = createSettingsMutationQueue(async () => saveResults.shift())

  const result = await persist(
    () => events.push('mutate'),
    () => events.push('rollback')
  )

  assert.equal(result, 'rolled-back')
  assert.deepEqual(events, ['mutate', 'rollback'])
  assert.deepEqual(saveResults, [])
})

test('reports when both the settings save and rollback save fail', async () => {
  const saveResults = [false, false]
  const persist = createSettingsMutationQueue(async () => saveResults.shift())

  assert.equal(
    await persist(
      () => undefined,
      () => undefined
    ),
    'rollback-failed'
  )
  assert.deepEqual(saveResults, [])
})
