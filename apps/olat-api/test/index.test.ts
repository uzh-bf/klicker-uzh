import request from 'supertest'
import { describe, expect, test } from 'vitest'
import app, { StatusCode } from '../src/index.js'

const API_KEY = process.env.OLAT_API_KEY || ''

// account of "lecturer"
const provider = 'eduid'
const providerAccountId = '29440fb7-5347-4244-a83a-7ce8379d80e4'
const courseId = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
const courseIdNoGamification = 'efd54f15-ba92-4291-8ea8-911f365ae10b'

describe('OLAT-API general', () => {
  test('/health', async () => {
    const response = await request(app).get('/')
    expect(response.status).toBe(StatusCode.SUCCESS)
  })
})

describe('OLAT-API /api/configuration/courses', () => {
  test('Valid', async () => {
    const response = await request(app)
      .get('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .query({
        provider: provider,
        providerAccountId: providerAccountId,
      })
    const response_body_expected = {
      courses: [
        { id: '7c12e44e-d083-4acf-845e-4c34aaff6b49', title: 'Testkurs' },
        { id: '09d7e367-b9af-4bbc-b051-4ac32d2c09c3', title: 'Testkurs 2' },
        {
          id: 'efd54f15-ba92-4291-8ea8-911f365ae10b',
          title: 'Non-Gamified Course',
        },
      ],
      timestamp: '',
      api: 'olat-api',
    }
    expect(response.status).toBe(StatusCode.SUCCESS)
    expect(response.body).toHaveProperty('courses')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('api')
    expect(response.body.api).toBe(response_body_expected.api)
    expect(response.body.courses).toEqual(response_body_expected.courses)
  })

  test('No courses found', async () => {
    const response = await request(app)
      .get('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .query({
        provider: 'non-existing-provider',
        providerAccountId: 'non-existing-provider-account-id',
      })

    expect(response.status).toBe(StatusCode.NOT_FOUND)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('No courses found for this user')
  })

  test('Missing requestParameters', async () => {
    let response = await request(app)
      .get('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .query({
        providerAccountId: providerAccountId,
      })
    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing provider')

    response = await request(app)
      .get('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .query({
        provider: provider,
      })
    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing providerAccountId')
  })

  test('Missing/Invalid API key', async () => {
    let response = await request(app)
      .get('/api/configuration/courses')
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')
      .query({
        provider: provider,
        providerAccountId: providerAccountId,
      })
    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .get('/api/configuration/courses')
      .set('Content-Type', 'application/json')
      .query({
        provider: provider,
        providerAccountId: providerAccountId,
      })
    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Missing Content-Type', async () => {
    const response = await request(app)
      .get('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .query({
        provider: provider,
        providerAccountId: providerAccountId,
      })
    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid request headers')
  })
})

describe('OLAT-API /api/configuration/activityTypes', () => {
  test('Valid', async () => {
    const response = await request(app)
      .get('/api/configuration/activityTypes')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    const response_body_expected = {
      activityTypes: [
        {
          id: 'LIVE_QUIZZES',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'live-quizzes',
          path: '/liveQuizzes',
        },
        {
          id: 'PRACTICE_QUIZZES',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'practice-quizzes',
          path: '/practiceQuizzes',
        },
        {
          id: 'MICRO_LEARNINGS',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'micro-learnings',
          path: '/microLearnings',
        },
        {
          id: 'MANAGE_ACCOUNT',
          isEmailTransferRequired: true,
          olatConfigurationKey: 'manage-account',
          path: '/createAccount',
        },
        {
          id: 'DOCS',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'docs',
          path: '/docs',
        },
        {
          id: 'LIVE_QUIZ',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'live-quiz',
          path: '/liveQuiz',
        },
        {
          id: 'PRACTICE_QUIZ',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'quiz',
          path: '/quiz',
        },
        {
          id: 'MICRO_LEARNING',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'micro-learning',
          path: '/microlearning',
        },
        {
          id: 'COURSE_LEADERBOARD',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'course-leaderboard',
          path: '/',
        },
      ],
      timestamp: '',
      api: 'olat-api',
    }

    expect(response.status).toBe(StatusCode.SUCCESS)
    expect(response.body).toHaveProperty('activityTypes')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('api')
    expect(response.body.api).toBe(response_body_expected.api)
    expect(response.body.activityTypes).toEqual(
      response_body_expected.activityTypes
    )
  })

  test('Missing/Invalid API key', async () => {
    let response = await request(app)
      .get('/api/configuration/activityTypes')
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')
      .query({
        provider: provider,
        providerAccountId: providerAccountId,
      })
    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .get('/api/configuration/activityTypes')
      .set('Content-Type', 'application/json')
      .query({
        provider: provider,
        providerAccountId: providerAccountId,
      })
    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Missing Content-Type', async () => {
    const response = await request(app)
      .get('/api/configuration/activityTypes')
      .set('X-API-Key', API_KEY)
      .query({
        provider: provider,
        providerAccountId: providerAccountId,
      })
    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid request headers')
  })
})

describe('OLAT-API /api/configuration/course/:courseId/activityTypes', () => {
  test('Valid', async () => {
    let response = await request(app)
      .get(`/api/configuration/course/${courseId}/activityTypes`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    let response_body_expected = {
      activityTypes: [
        {
          id: 'LIVE_QUIZZES',
          title: 'Live Quiz Overview (5)',
          olatConfigurationKey: 'live-quizzes',
          isSubselectionRequired: false,
        },
        {
          id: 'PRACTICE_QUIZZES',
          title: 'Practice Quiz Overview (3)',
          olatConfigurationKey: 'practice-quizzes',
          isSubselectionRequired: false,
        },
        {
          id: 'MICRO_LEARNINGS',
          title: 'Micro Learning Overview (5)',
          olatConfigurationKey: 'micro-learnings',
          isSubselectionRequired: false,
        },
        {
          id: 'MANAGE_ACCOUNT',
          title: 'Manage Account',
          olatConfigurationKey: 'manage-account',
          isSubselectionRequired: false,
        },
        {
          id: 'DOCS',
          title: 'Documentation',
          olatConfigurationKey: 'docs',
          isSubselectionRequired: false,
        },
        {
          id: 'LIVE_QUIZ',
          title: 'Live Quiz',
          olatConfigurationKey: 'live-quiz',
          isSubselectionRequired: true,
        },
        {
          id: 'PRACTICE_QUIZ',
          title: 'Practice Quiz',
          olatConfigurationKey: 'quiz',
          isSubselectionRequired: true,
        },
        {
          id: 'MICRO_LEARNING',
          title: 'Micro Learning',
          olatConfigurationKey: 'micro-learning',
          isSubselectionRequired: true,
        },
        {
          id: 'COURSE_LEADERBOARD',
          title: 'Course Leaderboard',
          olatConfigurationKey: 'course-leaderboard',
          isSubselectionRequired: false,
        },
      ],
      timestamp: '',
      api: 'olat-api',
    }
    expect(response.status).toBe(StatusCode.SUCCESS)
    expect(response.body).toHaveProperty('activityTypes')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('api')
    expect(response.body.api).toBe(response_body_expected.api)
    expect(response.body.activityTypes).toEqual(
      response_body_expected.activityTypes
    )

    response = await request(app)
      .get(`/api/configuration/course/${courseIdNoGamification}/activityTypes`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    response_body_expected = {
      activityTypes: [
        {
          id: 'LIVE_QUIZZES',
          title: 'Live Quiz Overview (0)',
          olatConfigurationKey: 'live-quizzes',
          isSubselectionRequired: false,
        },
        {
          id: 'PRACTICE_QUIZZES',
          title: 'Practice Quiz Overview (0)',
          olatConfigurationKey: 'practice-quizzes',
          isSubselectionRequired: false,
        },
        {
          id: 'MICRO_LEARNINGS',
          title: 'Micro Learning Overview (0)',
          olatConfigurationKey: 'micro-learnings',
          isSubselectionRequired: false,
        },
        {
          id: 'MANAGE_ACCOUNT',
          title: 'Manage Account',
          olatConfigurationKey: 'manage-account',
          isSubselectionRequired: false,
        },
        {
          id: 'DOCS',
          title: 'Documentation',
          olatConfigurationKey: 'docs',
          isSubselectionRequired: false,
        },
        {
          id: 'PRACTICE_QUIZ',
          title: 'Practice Quiz',
          olatConfigurationKey: 'quiz',
          isSubselectionRequired: true,
        },
      ],
      timestamp: '',
      api: 'olat-api',
    }
    expect(response.status).toBe(StatusCode.SUCCESS)
    expect(response.body).toHaveProperty('activityTypes')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('api')
    expect(response.body.api).toBe(response_body_expected.api)
    expect(response.body.activityTypes).toEqual(
      response_body_expected.activityTypes
    )
  })
  // TODO: invalid path
  test('Invalid courseId', async () => {
    let response = await request(app)
      .get('/api/configuration/course/invalid-course-id/activityTypes')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid courseID')
  })

  test('Course not found', async () => {
    const response = await request(app)
      .get(
        '/api/configuration/course/00000000-0000-0000-0000-000000000000/activityTypes'
      )
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.NOT_FOUND)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Course not found')
  })

  test('Missing/Invalid API key', async () => {
    let response = await request(app)
      .get(`/api/configuration/course/${courseId}/activityTypes`)
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .get(`/api/configuration/course/${courseId}/activityTypes`)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Missing Content-Type', async () => {
    const response = await request(app)
      .get(`/api/configuration/course/${courseId}/activityTypes`)
      .set('X-API-Key', API_KEY)

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid request headers')
  })
})

describe('OLAT-API /api/configuration/course/:courseId/:activityTypeId', () => {
  test('Valid', async () => {
    let response = await request(app)
      .get(`/api/configuration/course/${courseId}/live-quiz`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    let response_body_expected = {
      activityTypes: [
        {
          id: '1ec093e0-b6b6-421f-98ac-98ab146505f7',
          title: 'Test mit Multiplier',
        },
        {
          id: '35aad5d9-285d-4dda-9e19-7507ee16e9e1',
          title: 'Test Live Quiz',
        },
        {
          id: 'ef1b2304-6b61-4eb0-98e0-b3fb8105ba2a',
          title: 'Live Quiz Template',
        },
        {
          id: '20325ec6-0ce7-4e24-bd79-5c1a46f64c47',
          title: 'Test Live Quiz 2',
        },
        {
          id: '166608f3-10b6-4e62-9842-ab8b774fae58',
          title: 'Test Live Quiz 3',
        },
      ],
      timestamp: '',
      api: 'olat-api',
    }
    expect(response.status).toBe(StatusCode.SUCCESS)
    expect(response.body).toHaveProperty('activityTypes')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('api')
    expect(response.body.api).toBe(response_body_expected.api)
    expect(response.body.activityTypes).toEqual(
      response_body_expected.activityTypes
    )

    const activityTypesGeneral = [
      'live-quizzes',
      'practice-quizzes',
      'micro-learnings',
      'manage-account',
      'docs',
      'course-leaderboard',
    ]
    for (const activityTypeGeneral of activityTypesGeneral) {
      response = await request(app)
        .get(`/api/configuration/course/${courseId}/${activityTypeGeneral}`)
        .set('X-API-Key', API_KEY)
        .set('Content-Type', 'application/json')
      response_body_expected = {
        activityTypes: [],
        timestamp: '',
        api: 'olat-api',
      }

      expect(response.status).toBe(StatusCode.SUCCESS)
      expect(response.body).toHaveProperty('activityTypes')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('api')
      expect(response.body.api).toBe(response_body_expected.api)
      expect(response.body.activityTypes).toEqual(
        response_body_expected.activityTypes
      )
    }
  })

  test('Invalid courseId', async () => {
    const response = await request(app)
      .get('/api/configuration/course/invalid-course-id/live-quiz')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid courseID')
  })

  test('Invalid activityTypeKey', async () => {
    let response = await request(app)
      .get(`/api/configuration/course/${courseId}/invalid-activity-type`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid activityTypeKey')
  })

  test('Course not found', async () => {
    const response = await request(app)
      .get(
        '/api/configuration/course/00000000-0000-0000-0000-000000000000/live-quiz'
      )
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.NOT_FOUND)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Course not found')
  })

  test('Missing/Invalid API key', async () => {
    let response = await request(app)
      .get(`/api/configuration/course/${courseId}/live-quiz`)
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .get(`/api/configuration/course/${courseId}/live-quiz`)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Missing Content-Type', async () => {
    const response = await request(app)
      .get(`/api/configuration/course/${courseId}/live-quiz`)
      .set('X-API-Key', API_KEY)

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid request headers')
  })
})
