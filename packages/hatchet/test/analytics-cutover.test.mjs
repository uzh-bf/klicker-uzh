import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareHatchetTasks } from '../src/tasks.ts'

function makeHatchet() {
  const registeredWorkflows = []
  return {
    registeredWorkflows,
    events: {
      push: async () => undefined,
    },
    task(definition) {
      return definition
    },
    workflow(definition) {
      registeredWorkflows.push(definition)
      const registeredTasks = []
      return {
        ...definition,
        registeredTasks,
        task(taskDefinition) {
          registeredTasks.push(taskDefinition)
          return taskDefinition
        },
      }
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
  assert.deepEqual(hatchet.registeredWorkflows, [])
  assert.equal(prepared.scanEndedCourses.name, 'scan-ended-courses')
  assert.deepEqual(prepared.scanEndedCourses.onCrons, ['0 1 * * *'])
})
