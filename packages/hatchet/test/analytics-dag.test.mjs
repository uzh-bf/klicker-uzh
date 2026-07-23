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
    workflow(definition) {
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

test('platform analytics waits for course analytics and validity waits for every task', () => {
  const handlers = new Proxy(
    {},
    {
      get: () => async () => true,
    }
  )
  const prepared = prepareHatchetTasks({
    hatchet: makeHatchet(),
    pubSub: {},
    emitter: {},
    redisExec: {},
    redisAssessmentExec: {},
    handlers,
  })
  assert.deepEqual(prepared.recomputeLearningAnalytics.onEvents, [
    'course-ended',
    'admin-recompute-analytics',
    'admin-recompute-analytics-full',
  ])
  const definitions = new Map(
    prepared.recomputeLearningAnalytics.registeredTasks.map(
      (taskDefinition) => [taskDefinition.name, taskDefinition]
    )
  )
  const parentNames = (name) =>
    (definitions.get(name)?.parents ?? []).map((parent) => parent.name)

  assert.deepEqual(parentNames('s13-platform-semester-analytics'), [
    's2-course-heatmap',
  ])
  assert.deepEqual(
    new Set(parentNames('s99-mark-analytics-valid')),
    new Set([
      's0-participant-analytics',
      's1-aggregated-analytics',
      's2-course-heatmap',
      's3-instance-activity-perf',
      's4-participant-perf',
      's5-participant-course-analytics',
      's6-activity-progress',
      's7-participant-activity-perf',
      's8-chat-analytics',
      's9-aggregated-chatbot-analytics',
      's10-chat-topic-clustering',
      's11-chat-quiz-correlation',
      's13-platform-semester-analytics',
      's14-live-quiz-assessment-analytics',
    ])
  )
})
