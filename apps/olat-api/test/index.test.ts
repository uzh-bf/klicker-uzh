import { PrismaClient } from '@klicker-uzh/prisma'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import app, { StatusCode } from '../src/index.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'
import {
  Course,
  courseFive,
  courseFour,
  courseOne,
  courseThree,
  courseTwo,
  userOne,
  userTwo,
} from './userData.js'
const API_KEY = process.env.OLAT_API_KEY || '1234567890abcdef'

let prisma: PrismaClient

beforeAll(async () => {
  const newPrisma: PrismaClient = await initializePrisma()
  prisma = newPrisma
  await testInitialization(prisma)
})

afterAll(async () => {
  await testCleanup(prisma)
  await prisma.$disconnect()
})

describe('OLAT-API general', () => {
  test('/health', async () => {
    const response = await request(app).get('/')
    expect(response.status).toBe(StatusCode.SUCCESS)
  })
})

describe('OLAT-API /api/configuration/courses', () => {
  test('Valid', async () => {
    const users = [
      {
        user: userOne,
        response: {
          courses: [
            { id: courseOne.id, title: courseOne.name },
            { id: courseTwo.id, title: courseTwo.name },
          ],
          timestamp: '',
          api: 'olat-api',
        },
      },
      {
        user: userTwo,
        response: {
          courses: [
            { id: courseThree.id, title: courseThree.name },
            { id: courseFour.id, title: courseFour.name },
            { id: courseFive.id, title: courseFive.name },
          ],
          timestamp: '',
          api: 'olat-api',
        },
      },
    ]
    users.forEach(async (user) => {
      const provider = user.user.provider
      const providerAccountId = user.user.providerAccountId

      const response = await request(app)
        .get('/api/configuration/courses')
        .set('X-API-Key', API_KEY)
        .set('Content-Type', 'application/json')
        .query({
          provider: provider,
          providerAccountId: providerAccountId,
        })
      const response_body_expected = user.response
      expect(response.status).toBe(StatusCode.SUCCESS)
      expect(response.body).toHaveProperty('courses')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('api')
      expect(response.body.api).toBe(response_body_expected.api)
      expect(response.body.courses).toEqual(response_body_expected.courses)
    })
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
        providerAccountId: userOne.providerAccountId,
      })
    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing provider')

    response = await request(app)
      .get('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .query({
        provider: userOne.provider,
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
        provider: userOne.provider,
        providerAccountId: userOne.providerAccountId,
      })
    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .get('/api/configuration/courses')
      .set('Content-Type', 'application/json')
      .query({
        provider: userOne.provider,
        providerAccountId: userOne.providerAccountId,
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
        provider: userOne.provider,
        providerAccountId: userOne.providerAccountId,
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
          olatConfigurationKey: 'practice-quiz',
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

    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .get('/api/configuration/activityTypes')
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Missing Content-Type', async () => {
    const response = await request(app)
      .get('/api/configuration/activityTypes')
      .set('X-API-Key', API_KEY)

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid request headers')
  })
})

function getExpectedResponse(
  nLQ: number,
  nPQ: number,
  nML: number,
  isGamificationEnabled: boolean
) {
  let response = {
    activityTypes: [
      {
        id: 'LIVE_QUIZZES',
        title: `Live Quiz Overview (${nLQ})`,
        olatConfigurationKey: 'live-quizzes',
        isSubselectionRequired: false,
      },
      {
        id: 'PRACTICE_QUIZZES',
        title: `Practice Quiz Overview (${nPQ})`,
        olatConfigurationKey: 'practice-quizzes',
        isSubselectionRequired: false,
      },
      {
        id: 'MICRO_LEARNINGS',
        title: `Micro Learning Overview (${nML + 1})`,
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
    ],
    timestamp: '',
    api: 'olat-api',
  }

  if (nLQ !== 0) {
    response.activityTypes.push({
      id: 'LIVE_QUIZ',
      title: 'Live Quiz',
      olatConfigurationKey: 'live-quiz',
      isSubselectionRequired: true,
    })
  }
  if (nPQ !== 0) {
    response.activityTypes.push({
      id: 'PRACTICE_QUIZ',
      title: 'Practice Quiz',
      olatConfigurationKey: 'practice-quiz',
      isSubselectionRequired: true,
    })
  }
  if (nML !== 0) {
    response.activityTypes.push({
      id: 'MICRO_LEARNING',
      title: 'Micro Learning',
      olatConfigurationKey: 'micro-learning',
      isSubselectionRequired: true,
    })
  }
  if (isGamificationEnabled) {
    response.activityTypes.push({
      id: 'COURSE_LEADERBOARD',
      title: 'Course Leaderboard',
      olatConfigurationKey: 'course-leaderboard',
      isSubselectionRequired: false,
    })
  }
  return response
}

describe('OLAT-API /api/configuration/course/:courseId/activityTypes', () => {
  test('Valid', async () => {
    const courses = [
      {
        course: courseOne,
        nLQ: 3,
        nPQ: 2,
        nML: 1,
        isGamificationEnabled: true,
      },
      {
        course: courseTwo,
        nLQ: 0,
        nPQ: 1,
        nML: 2,
        isGamificationEnabled: false,
      },
      {
        course: courseThree,
        nLQ: 2,
        nPQ: 1,
        nML: 1,
        isGamificationEnabled: true,
      },
      {
        course: courseFour,
        nLQ: 0,
        nPQ: 0,
        nML: 0,
        isGamificationEnabled: true,
      },
      {
        course: courseFive,
        nLQ: 1,
        nPQ: 0,
        nML: 0,
        isGamificationEnabled: false,
      },
    ]
    courses.forEach(async (course) => {
      const courseId = course.course.id
      const nLQ = course.nLQ
      const nPQ = course.nPQ
      const nML = course.nML
      const isGamificationEnabled = course.isGamificationEnabled

      let response = await request(app)
        .get(`/api/configuration/course/${courseId}/activityTypes`)
        .set('X-API-Key', API_KEY)
        .set('Content-Type', 'application/json')

      let response_body_expected = getExpectedResponse(
        nLQ,
        nPQ,
        nML,
        isGamificationEnabled
      )

      expect(response.status).toBe(StatusCode.SUCCESS)
      expect(response.body).toHaveProperty('activityTypes')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('api')
      expect(response.body.api).toBe(response_body_expected.api)
      expect(response.body.activityTypes).toEqual(
        response_body_expected.activityTypes
      )
    })
  })

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
      .get(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .get(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Missing Content-Type', async () => {
    const response = await request(app)
      .get(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('X-API-Key', API_KEY)

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid request headers')
  })
})

function getExpectedTitles(n: number, prefix: string, course: Course) {
  return Array.from(
    { length: n },
    (_, i) => `${prefix} ${i + 1} for ${course.name}`
  )
}
describe('OLAT-API /api/configuration/course/:courseId/:activityTypeId', () => {
  test('Valid', async () => {
    const courses = [
      {
        course: courseOne,
        activityTypeId: 'live-quiz',
        titles: getExpectedTitles(3, 'Live Quiz', courseOne),
      },
      {
        course: courseOne,
        activityTypeId: 'practice-quiz',
        titles: getExpectedTitles(2, 'Practice Quiz', courseOne),
      },
      {
        course: courseOne,
        activityTypeId: 'micro-learning',
        titles: getExpectedTitles(1, 'Micro Learning', courseOne),
      },
      {
        course: courseTwo,
        activityTypeId: 'live-quiz',
        titles: getExpectedTitles(0, 'Live Quiz', courseTwo),
      },
      {
        course: courseTwo,
        activityTypeId: 'practice-quiz',
        titles: getExpectedTitles(1, 'Practice Quiz', courseTwo),
      },
      {
        course: courseTwo,
        activityTypeId: 'micro-learning',
        titles: getExpectedTitles(2, 'Micro Learning', courseTwo),
      },
      {
        course: courseThree,
        activityTypeId: 'live-quiz',
        titles: getExpectedTitles(2, 'Live Quiz', courseThree),
      },
      {
        course: courseThree,
        activityTypeId: 'practice-quiz',
        titles: getExpectedTitles(1, 'Practice Quiz', courseThree),
      },
      {
        course: courseThree,
        activityTypeId: 'micro-learning',
        titles: getExpectedTitles(1, 'Micro Learning', courseThree),
      },
      {
        course: courseFour,
        activityTypeId: 'live-quiz',
        titles: getExpectedTitles(0, 'Live Quiz', courseFour),
      },
      {
        course: courseFour,
        activityTypeId: 'practice-quiz',
        titles: getExpectedTitles(0, 'Practice Quiz', courseFour),
      },
      {
        course: courseFour,
        activityTypeId: 'micro-learning',
        titles: getExpectedTitles(0, 'Micro Learning', courseFour),
      },
      {
        course: courseFive,
        activityTypeId: 'live-quiz',
        titles: getExpectedTitles(1, 'Live Quiz', courseFive),
      },
      {
        course: courseFive,
        activityTypeId: 'practice-quiz',
        titles: getExpectedTitles(0, 'Practice Quiz', courseFive),
      },
      {
        course: courseFive,
        activityTypeId: 'micro-learning',
        titles: getExpectedTitles(0, 'Micro Learning', courseFive),
      },
    ]
    for (const course of courses) {
      const courseId = course.course.id
      const activityTypeId = course.activityTypeId
      let response = await request(app)
        .get(`/api/configuration/course/${courseId}/${activityTypeId}`)
        .set('X-API-Key', API_KEY)
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(StatusCode.SUCCESS)
      expect(response.body).toHaveProperty('activityTypes')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('api')
      expect(response.body.api).toBe('olat-api')
      expect(
        response.body.activityTypes.map((activity: any) => activity.title)
      ).toEqual(course.titles)
    }
    for (const course of [
      courseOne,
      courseTwo,
      courseThree,
      courseFour,
      courseFive,
    ]) {
      const courseId = course.id
      const activityTypesGeneral = [
        'live-quizzes',
        'practice-quizzes',
        'micro-learnings',
        'manage-account',
        'docs',
        'course-leaderboard',
      ]
      for (const activityTypeGeneral of activityTypesGeneral) {
        let response = await request(app)
          .get(`/api/configuration/course/${courseId}/${activityTypeGeneral}`)
          .set('X-API-Key', API_KEY)
          .set('Content-Type', 'application/json')

        expect(response.status).toBe(StatusCode.SUCCESS)
        expect(response.body).toHaveProperty('activityTypes')
        expect(response.body).toHaveProperty('timestamp')
        expect(response.body).toHaveProperty('api')
        expect(response.body.api).toBe('olat-api')
        expect(response.body.activityTypes).toEqual([])
      }
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
      .get(`/api/configuration/course/${courseOne.id}/invalid-activity-type`)
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
      .get(`/api/configuration/course/${courseOne.id}/live-quiz`)
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .get(`/api/configuration/course/${courseOne.id}/live-quiz`)
      .set('Content-Type', 'application/json')

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Missing Content-Type', async () => {
    const response = await request(app)
      .get(`/api/configuration/course/${courseOne.id}/live-quiz`)
      .set('X-API-Key', API_KEY)

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid request headers')
  })
})
