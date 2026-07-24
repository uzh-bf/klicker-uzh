import assert from 'node:assert/strict'
import test from 'node:test'

import { prepareHatchetTasks } from '../src/tasks.ts'

function makeHatchet(pushedEvents = []) {
  return {
    events: {
      push: async (...args) => {
        pushedEvents.push(args)
      },
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

test('ended-course scanner reactivates finalized courses with dirty chat privacy state', async () => {
  const handlers = new Proxy(
    {},
    {
      get: () => async () => true,
    }
  )
  const pushedEvents = []
  const queries = []
  const hatchet = makeHatchet(pushedEvents)
  const prepared = prepareHatchetTasks({
    hatchet,
    pubSub: {},
    emitter: {},
    redisExec: {},
    redisAssessmentExec: {},
    handlers,
    database: {
      $queryRaw: async (query) => {
        queries.push(query)
        return [{ id: 'course-with-late-consent' }]
      },
    },
  })

  const result = await prepared.scanEndedCourses.fn(
    {},
    { logger: { info: async () => undefined } }
  )

  assert.deepEqual(result, { success: true, emitted: 1 })
  assert.equal(queries.length, 1)
  const queryText = queries[0].strings.join('')
  assert.match(queryText, /c\."analyticsFinalizedAt" IS NULL/)
  assert.match(
    queryText,
    /cuc\."disclaimerAcceptedAt" > dirty_course\."chatAnalyticsValidAt"/
  )
  assert.match(
    queryText,
    /cuc\."acceptedDisclaimerId" IS DISTINCT FROM cb\."disclaimerId"/
  )
  assert.match(queryText, /WITH dirty_chat_courses AS MATERIALIZED/)
  assert.match(queryText, /FROM "ParticipantChatAnalytics" pca/)
  assert.equal(pushedEvents.length, 1)
  assert.equal(pushedEvents[0][0], 'course-ended')
  assert.deepEqual(pushedEvents[0][1], {
    mode: 'finalize',
    courseId: 'course-with-late-consent',
  })
})
