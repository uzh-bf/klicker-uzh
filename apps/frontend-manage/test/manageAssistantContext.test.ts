import assert from 'node:assert/strict'
import {
  buildManageAssistantContext,
  inferManageSurface,
} from '../src/components/assistant/manageAssistantContext'

// The manage index page is the question library.
assert.equal(inferManageSurface('/'), 'question-pool')

assert.deepEqual(
  buildManageAssistantContext({
    asPath: '/resources/catalog?tagIds=abc&token=secret',
    locale: 'de',
    pathname: '/resources/catalog',
    query: {
      tagIds: 'abc',
      token: 'secret',
    },
  }),
  {
    version: 1,
    source: 'manage',
    surface: 'question-pool',
    locale: 'de',
    route: {
      asPath: '/resources/catalog?tagIds=abc',
      pathname: '/resources/catalog',
    },
    query: {
      tagIds: 'abc',
    },
  }
)

assert.deepEqual(
  buildManageAssistantContext({
    asPath: '/analytics/12/quizzes/34?tab=responses',
    locale: undefined,
    pathname: '/analytics/[courseId]/quizzes/[id]',
    query: {
      courseId: '12',
      id: '34',
      tab: 'responses',
    },
  }),
  {
    version: 1,
    source: 'manage',
    surface: 'evaluation',
    locale: 'en',
    route: {
      asPath: '/analytics/12/quizzes/34?tab=responses',
      pathname: '/analytics/[courseId]/quizzes/[id]',
    },
    ids: {
      courseId: '12',
      activityId: '34',
    },
    query: {
      courseId: '12',
      id: '34',
      tab: 'responses',
    },
  }
)

// Clamp asPath to the backend contract limit (MAX_ROUTE_LENGTH in
// apps/chat/src/services/manageContext.ts) so a long filter/search URL
// doesn't get the whole context silently dropped by the chat-side schema.
{
  const longQuery = Array.from(
    { length: 20 },
    (_, index) => `key${index}=${'v'.repeat(200)}`
  ).join('&')
  const longAsPath = `/resources/catalog?${longQuery}`
  assert.ok(longAsPath.length > 512)

  const context = buildManageAssistantContext({
    asPath: longAsPath,
    locale: 'en',
    pathname: '/resources/catalog',
    query: {},
  })

  assert.ok(context.route.asPath.length <= 512)
}
