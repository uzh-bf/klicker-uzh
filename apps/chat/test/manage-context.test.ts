import { describe, expect, test } from 'vitest'
import {
  getManageContextLabel,
  sanitizeManageAssistantContext,
} from '../src/services/manageContext'

describe('Manage assistant context', () => {
  test('keeps safe route context and strips unsupported fields', () => {
    const context = sanitizeManageAssistantContext({
      version: 1,
      source: 'manage',
      surface: 'question-pool',
      locale: 'de',
      route: {
        asPath: '/resources/catalog?tagIds=abc',
        pathname: '/resources/catalog',
      },
      ids: {
        courseId: 'course-1',
      },
      query: {
        tagIds: 'abc',
        token: 'secret',
      },
      rawDraft: 'secret',
    })

    expect(context).toEqual({
      version: 1,
      source: 'manage',
      surface: 'question-pool',
      locale: 'de',
      route: {
        asPath: '/resources/catalog?tagIds=abc',
        pathname: '/resources/catalog',
      },
      ids: {
        courseId: 'course-1',
      },
      query: {
        tagIds: 'abc',
      },
    })
    expect(JSON.stringify(context)).not.toContain('secret')
  })

  test('builds a compact label', () => {
    expect(
      getManageContextLabel({
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
      })
    ).toBe('Evaluation - Course 12')
  })
})
