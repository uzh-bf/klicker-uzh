import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareHatchetTasks } from '../src/tasks.ts'

function makeHatchet() {
  return {
    events: {
      push: async () => undefined,
    },
    task(definition) {
      return definition
    },
    workflow() {
      assert.fail('TypeScript must not register an analytics workflow')
    },
  }
}

test('TypeScript keeps the ended-course scanner without registering an analytics DAG', () => {
  const handlers = new Proxy(
    {},
    {
      get: () => async () => true,
    }
  )
  const hatchet = makeHatchet()
  const prepared = prepareHatchetTasks({
    hatchet,
    pubSub: {},
    emitter: {},
    redisExec: {},
    redisAssessmentExec: {},
    handlers,
  })
  assert.equal('recomputeLearningAnalytics' in prepared, false)
  assert.equal(prepared.scanEndedCourses.name, 'scan-ended-courses')
  assert.deepEqual(prepared.scanEndedCourses.onCrons, ['0 1 * * *'])
})
