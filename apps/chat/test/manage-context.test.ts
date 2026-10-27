import { describe, expect, test } from 'vitest'
import {
  formatManageContextForPrompt,
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

  test('uses localized labels supplied by the Manage surface', () => {
    expect(
      getManageContextLabel(
        {
          version: 1,
          source: 'manage',
          surface: 'evaluation',
          locale: 'de',
          route: {
            asPath: '/analytics/12/quizzes/34?tab=responses',
            pathname: '/analytics/[courseId]/quizzes/[id]',
          },
          ids: {
            courseId: '12',
          },
        },
        {
          surfaces: {
            'activity-creation': 'Aktivität einrichten',
            'course-dashboard': 'Kursübersicht',
            'element-editor': 'Frageneditor',
            evaluation: 'Auswertung',
            general: 'Verwalten',
            'question-pool': 'Fragepool',
          },
          entities: {
            activity: (id) => `Aktivität ${id}`,
            course: (id) => `Kurs ${id}`,
            question: (id) => `Frage ${id}`,
          },
        }
      )
    ).toBe('Auswertung - Kurs 12')
  })

  test('caps sanitized query keys', () => {
    const query = Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [`key${index}`, `${index}`])
    )
    const context = sanitizeManageAssistantContext({
      version: 1,
      source: 'manage',
      surface: 'question-pool',
      locale: 'en',
      route: {
        asPath: '/resources/catalog',
        pathname: '/resources/catalog',
      },
      query: {
        token: 'secret',
        ...query,
      },
    })

    expect(Object.keys(context?.query ?? {})).toHaveLength(20)
    expect(context?.query).not.toHaveProperty('token')
    expect(context?.query).toHaveProperty('key0', '0')
    expect(context?.query).toHaveProperty('key19', '19')
    expect(context?.query).not.toHaveProperty('key20')
  })

  test('sanitizes sensitive keys embedded directly in route.asPath', () => {
    const context = sanitizeManageAssistantContext({
      version: 1,
      source: 'manage',
      surface: 'question-pool',
      locale: 'en',
      route: {
        asPath: '/resources/catalog?tagIds=abc&token=secret&sessionId=xyz',
        pathname: '/resources/catalog',
      },
    })

    expect(context?.route.asPath).toBe('/resources/catalog?tagIds=abc')
    expect(JSON.stringify(context)).not.toContain('secret')
    expect(JSON.stringify(context)).not.toContain('xyz')
  })

  test('caps the number of query keys kept from route.asPath', () => {
    const query = Array.from(
      { length: 30 },
      (_, index) => `key${index}=${index}`
    ).join('&')

    const context = sanitizeManageAssistantContext({
      version: 1,
      source: 'manage',
      surface: 'question-pool',
      locale: 'en',
      route: {
        asPath: `/resources/catalog?${query}`,
        pathname: '/resources/catalog',
      },
    })

    const params = new URLSearchParams(context?.route.asPath.split('?')[1])
    expect(Array.from(params.keys())).toHaveLength(20)
    expect(params.has('key19')).toBe(true)
    expect(params.has('key20')).toBe(false)
  })

  test('formats the prompt with template, instance and quiz IDs', () => {
    const context = sanitizeManageAssistantContext({
      version: 1,
      source: 'manage',
      surface: 'element-editor',
      locale: 'en',
      route: {
        asPath: '/templates/12',
        pathname: '/templates/[id]',
      },
      ids: {
        templateId: '12',
        instanceId: '34',
        quizId: '56',
      },
    })

    const prompt = formatManageContextForPrompt(context)

    expect(prompt).toContain('Template ID: 12')
    expect(prompt).toContain('Instance ID: 34')
    expect(prompt).toContain('Quiz ID: 56')
  })
})
