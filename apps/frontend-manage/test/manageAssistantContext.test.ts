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
