import { PrismaClient } from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import app from '../src/index.js'
import { StatusCode } from '../src/types.js'
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

const API_KEY = process.env.OLAT_API_KEY
if (!API_KEY) {
  console.error('Undefined API Key')
  process.exit(1)
}

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

function getExpectedResponse(isGamificationEnabled: boolean) {
  let response = {
    activityTypes: [
      {
        id: 'MANAGE_ACCOUNT',
        title_de: 'Konto verwalten',
        title_en: 'Manage Account',
        title_fr: 'Gérer le compte',
        title_it: "Gestire l'account",
        olatConfigurationKey: 'manage-account',
        isSubselectionRequired: false,
      },
      {
        id: 'DOCS',
        title_de: 'Dokumentation',
        title_en: 'Documentation',
        title_fr: 'Documentation',
        title_it: 'Documentazione',
        olatConfigurationKey: 'docs',
        isSubselectionRequired: false,
      },
      {
        id: 'LIVE_QUIZ',
        title_de: 'Live Quiz',
        title_en: 'Live Quiz',
        title_fr: 'Live Quiz',
        title_it: 'Live Quiz',
        olatConfigurationKey: 'live-quiz',
        isSubselectionRequired: true,
      },
      {
        id: 'PRACTICE_QUIZ',
        title_de: 'Übungsquiz',
        title_en: 'Practice Quiz',
        title_fr: 'Practice Quiz',
        title_it: 'Practice Quiz',
        olatConfigurationKey: 'practice-quiz',
        isSubselectionRequired: true,
      },
      {
        id: 'MICRO_LEARNING',
        title_de: 'Microlearning',
        title_en: 'Microlearning',
        title_fr: 'Microlearning',
        title_it: 'Microlearning',
        olatConfigurationKey: 'micro-learning',
        isSubselectionRequired: true,
      },
    ],
    timestamp: '',
  }

  if (isGamificationEnabled) {
    response.activityTypes.push({
      id: 'COURSE_LEADERBOARD',
      title_de: 'Kurs-Rangliste',
      title_en: 'Course Leaderboard',
      title_fr: 'Classement du cours',
      title_it: 'Classifica del corso',
      olatConfigurationKey: 'course-leaderboard',
      isSubselectionRequired: false,
    })
  }
  return response
}

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
        },
      },
    ]
    users.forEach(async (user) => {
      const providerAccountId = user.user.providerAccountId

      const response = await request(app)
        .post('/api/configuration/courses')
        .set('X-API-Key', API_KEY)
        .set('Content-Type', 'application/json')
        .send({ identityMappingIdentifier: providerAccountId })
      const response_body_expected = user.response

      expect(response.status).toBe(StatusCode.SUCCESS)
      expect(response.body).toHaveProperty('courses')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body.courses).toEqual(response_body_expected.courses)
    })
  })

  test('Missing/Invalid providerAccount', async () => {
    let response = await request(app)
      .post('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({})

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing providerAccountId')

    response = await request(app)
      .post('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: 'invalid-provider-account' })

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe(
      'Extraction of provider from providerAccountId failed'
    )
  })

  test('Missing/Invalid API key', async () => {
    let response = await request(app)
      .post('/api/configuration/courses')
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: userOne.providerAccountId })
    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .post('/api/configuration/courses')
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: userOne.providerAccountId })
    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Unsupported Content-Type', async () => {
    const response = await request(app)
      .post('/api/configuration/courses')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/pdf')
      .send(
        JSON.stringify({ identityMappingIdentifier: userOne.providerAccountId })
      )
    expect(response.status).toBe(StatusCode.UNSUPPORTED_MEDIA_TYPE)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Unsupported content type')
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
          path: '/liveQuizzes',
        },
        {
          id: 'PRACTICE_QUIZ',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'practice-quiz',
          path: '/practiceQuizzes',
        },
        {
          id: 'MICRO_LEARNING',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'micro-learning',
          path: '/microLearnings',
        },
        {
          id: 'CHATBOT',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'chatbot',
          path: '/chatbot',
        },
        {
          id: 'COURSE_LEADERBOARD',
          isEmailTransferRequired: false,
          olatConfigurationKey: 'course-leaderboard',
          path: '/',
        },
      ],
      timestamp: '',
    }

    expect(response.status).toBe(StatusCode.SUCCESS)
    expect(response.body).toHaveProperty('activityTypes')
    expect(response.body).toHaveProperty('timestamp')
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

  test('Unsupported Content-Type', async () => {
    const response = await request(app)
      .get('/api/configuration/activityTypes')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/pdf')

    expect(response.status).toBe(StatusCode.UNSUPPORTED_MEDIA_TYPE)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Unsupported content type')
  })
})

describe('OLAT-API /api/configuration/course/:courseId/activityTypes', () => {
  test('Valid', async () => {
    const courses = [
      {
        course: courseOne,
        numberLiveQuizzes: 3,
        numberPracticeQuizzes: 2,
        numberMicroLearnings: 1,
        isGamificationEnabled: true,
      },
      {
        course: courseTwo,
        numberLiveQuizzes: 0,
        numberPracticeQuizzes: 1,
        numberMicroLearnings: 2,
        isGamificationEnabled: false,
      },
      {
        course: courseThree,
        numberLiveQuizzes: 2,
        numberPracticeQuizzes: 1,
        numberMicroLearnings: 1,
        isGamificationEnabled: true,
      },
      {
        course: courseFour,
        numberLiveQuizzes: 0,
        numberPracticeQuizzes: 0,
        numberMicroLearnings: 0,
        isGamificationEnabled: true,
      },
      {
        course: courseFive,
        numberLiveQuizzes: 1,
        numberPracticeQuizzes: 0,
        numberMicroLearnings: 0,
        isGamificationEnabled: false,
      },
    ]

    courses.forEach(async (course) => {
      const courseId = course.course.id
      const isGamificationEnabled = course.isGamificationEnabled

      let response = await request(app)
        .post(`/api/configuration/course/${courseId}/activityTypes`)
        .set('X-API-Key', API_KEY)
        .set('Content-Type', 'application/json')
        .send({
          identityMappingIdentifier: course.course.owner.providerAccountId,
        })

      let response_body_expected = getExpectedResponse(isGamificationEnabled)
      expect(response.status).toBe(StatusCode.SUCCESS)
      expect(response.body).toHaveProperty('activityTypes')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body.activityTypes).toEqual(
        response_body_expected.activityTypes
      )
    })
  })

  test('Invalid courseId', async () => {
    let response = await request(app)
      .post('/api/configuration/course/invalid-course-id/activityTypes')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: userOne.providerAccountId })

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid courseID')
  })

  test('Course/Account not found', async () => {
    let response = await request(app)
      .post(
        '/api/configuration/course/00000000-0000-0000-0000-000000000000/activityTypes'
      )
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: userOne.providerAccountId })

    expect(response.status).toBe(StatusCode.NOT_FOUND)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Course or account not found')

    response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: '1234567890@thirdprovider.ch' })

    expect(response.status).toBe(StatusCode.NOT_FOUND)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Course or account not found')
  })

  test('Missing/Invalid providerAccount', async () => {
    let response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({})

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing providerAccountId')

    response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: 'invalid-provider-account' })

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe(
      'Extraction of provider from providerAccountId failed'
    )
  })

  test('Missing/Invalid API key', async () => {
    let response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: courseOne.owner.providerAccountId })

    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: courseOne.owner.providerAccountId })

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Unsupported Content-Type', async () => {
    const response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/activityTypes`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/pdf')
      .send(
        JSON.stringify({ identityMappingIdentifier: userOne.providerAccountId })
      )

    expect(response.status).toBe(StatusCode.UNSUPPORTED_MEDIA_TYPE)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Unsupported content type')
  })
})

function getExpectedTitles(
  n: number,
  activityType: 'LIVE_QUIZ' | 'PRACTICE_QUIZ' | 'MICRO_LEARNING',
  course: Course,
  language: 'de' | 'en' | 'fr' | 'it' = 'de'
) {
  return Array.from({ length: n }, (_, ix) => {
    if (activityType === 'LIVE_QUIZ') {
      return `Live Quiz ${ix + 1} for ${course.name}`
    } else if (activityType === 'PRACTICE_QUIZ') {
      const availableFrom =
        ix > 0 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined // consistent with test seed

      const name = `Practice Quiz ${ix + 1} for ${course.name}`
      if (!availableFrom) {
        return name
      }

      switch (language) {
        case 'de':
          return `${name} (verfügbar ab ${dayjs(availableFrom).format('DD.MM.YYYY')})`
        case 'en':
          return `${name} (available from ${dayjs(availableFrom).format('DD.MM.YYYY')})`
        case 'fr':
          return `${name} (disponible à partir du ${dayjs(availableFrom).format('DD.MM.YYYY')})`
        case 'it':
          return `${name} (disponibile da ${dayjs(availableFrom).format('DD.MM.YYYY')})`
      }
    } else if (activityType === 'MICRO_LEARNING') {
      const scheduledStartAt = new Date(
        Date.now() - (ix + 1) * 7 * 24 * 60 * 60 * 1000
      ) // consistent with test seed
      const scheduledEndAt = new Date(
        Date.now() + (ix + 1) * 14 * 24 * 60 * 60 * 1000
      ) // consistent with test seed

      const name = `Microlearning ${ix + 1} for ${course.name}`
      const scheduledStart = dayjs(scheduledStartAt).format('DD.MM.YYYY')
      const scheduledEnd = dayjs(scheduledEndAt).format('DD.MM.YYYY')
      switch (language) {
        case 'de':
          return `${name} (Start: ${scheduledStart} - Ende: ${scheduledEnd})`
        case 'en':
          return `${name} (Start: ${scheduledStart} - End: ${scheduledEnd})`
        case 'fr':
          return `${name} (Début: ${scheduledStart} - Fin: ${scheduledEnd})`
        case 'it':
          return `${name} (Inizio: ${scheduledStart} - Fine: ${scheduledEnd})`
      }
    }

    // fallback
    return `${activityType} ${ix + 1} for ${course.name}`
  })
}

describe('OLAT-API /api/configuration/course/:courseId/:activityTypeKey', () => {
  test('Valid', async () => {
    const courses = [
      {
        course: courseOne,
        owner: userOne,
        activityTypeKey: 'live-quiz',
        titlesDE: getExpectedTitles(3, 'LIVE_QUIZ', courseOne, 'de'),
        titlesEN: getExpectedTitles(3, 'LIVE_QUIZ', courseOne, 'en'),
        titlesFR: getExpectedTitles(3, 'LIVE_QUIZ', courseOne, 'fr'),
        titlesIT: getExpectedTitles(3, 'LIVE_QUIZ', courseOne, 'it'),
      },
      {
        course: courseOne,
        owner: userOne,
        activityTypeKey: 'practice-quiz',
        titlesDE: getExpectedTitles(2, 'PRACTICE_QUIZ', courseOne, 'de'),
        titlesEN: getExpectedTitles(2, 'PRACTICE_QUIZ', courseOne, 'en'),
        titlesFR: getExpectedTitles(2, 'PRACTICE_QUIZ', courseOne, 'fr'),
        titlesIT: getExpectedTitles(2, 'PRACTICE_QUIZ', courseOne, 'it'),
      },
      {
        course: courseOne,
        owner: userOne,
        activityTypeKey: 'micro-learning',
        titlesDE: getExpectedTitles(1, 'MICRO_LEARNING', courseOne, 'de'),
        titlesEN: getExpectedTitles(1, 'MICRO_LEARNING', courseOne, 'en'),
        titlesFR: getExpectedTitles(1, 'MICRO_LEARNING', courseOne, 'fr'),
        titlesIT: getExpectedTitles(1, 'MICRO_LEARNING', courseOne, 'it'),
      },
      {
        course: courseTwo,
        owner: userOne,
        activityTypeKey: 'live-quiz',
        titlesDE: getExpectedTitles(0, 'LIVE_QUIZ', courseTwo, 'de'),
        titlesEN: getExpectedTitles(0, 'LIVE_QUIZ', courseTwo, 'en'),
        titlesFR: getExpectedTitles(0, 'LIVE_QUIZ', courseTwo, 'fr'),
        titlesIT: getExpectedTitles(0, 'LIVE_QUIZ', courseTwo, 'it'),
      },
      {
        course: courseTwo,
        activityTypeKey: 'practice-quiz',
        titlesDE: getExpectedTitles(1, 'PRACTICE_QUIZ', courseTwo, 'de'),
        titlesEN: getExpectedTitles(1, 'PRACTICE_QUIZ', courseTwo, 'en'),
        titlesFR: getExpectedTitles(1, 'PRACTICE_QUIZ', courseTwo, 'fr'),
        titlesIT: getExpectedTitles(1, 'PRACTICE_QUIZ', courseTwo, 'it'),
      },
      {
        course: courseTwo,
        activityTypeKey: 'micro-learning',
        titlesDE: getExpectedTitles(2, 'MICRO_LEARNING', courseTwo, 'de'),
        titlesEN: getExpectedTitles(2, 'MICRO_LEARNING', courseTwo, 'en'),
        titlesFR: getExpectedTitles(2, 'MICRO_LEARNING', courseTwo, 'fr'),
        titlesIT: getExpectedTitles(2, 'MICRO_LEARNING', courseTwo, 'it'),
      },
      {
        course: courseThree,
        activityTypeKey: 'live-quiz',
        titlesDE: getExpectedTitles(2, 'LIVE_QUIZ', courseThree, 'de'),
        titlesEN: getExpectedTitles(2, 'LIVE_QUIZ', courseThree, 'en'),
        titlesFR: getExpectedTitles(2, 'LIVE_QUIZ', courseThree, 'fr'),
        titlesIT: getExpectedTitles(2, 'LIVE_QUIZ', courseThree, 'it'),
      },
      {
        course: courseThree,
        activityTypeKey: 'practice-quiz',
        titlesDE: getExpectedTitles(1, 'PRACTICE_QUIZ', courseThree, 'de'),
        titlesEN: getExpectedTitles(1, 'PRACTICE_QUIZ', courseThree, 'en'),
        titlesFR: getExpectedTitles(1, 'PRACTICE_QUIZ', courseThree, 'fr'),
        titlesIT: getExpectedTitles(1, 'PRACTICE_QUIZ', courseThree, 'it'),
      },
      {
        course: courseThree,
        activityTypeKey: 'micro-learning',
        titlesDE: getExpectedTitles(1, 'MICRO_LEARNING', courseThree, 'de'),
        titlesEN: getExpectedTitles(1, 'MICRO_LEARNING', courseThree, 'en'),
        titlesFR: getExpectedTitles(1, 'MICRO_LEARNING', courseThree, 'fr'),
        titlesIT: getExpectedTitles(1, 'MICRO_LEARNING', courseThree, 'it'),
      },
      {
        course: courseFour,
        activityTypeKey: 'live-quiz',
        titlesDE: getExpectedTitles(0, 'LIVE_QUIZ', courseFour, 'de'),
        titlesEN: getExpectedTitles(0, 'LIVE_QUIZ', courseFour, 'en'),
        titlesFR: getExpectedTitles(0, 'LIVE_QUIZ', courseFour, 'fr'),
        titlesIT: getExpectedTitles(0, 'LIVE_QUIZ', courseFour, 'it'),
      },
      {
        course: courseFour,
        activityTypeKey: 'practice-quiz',
        titlesDE: getExpectedTitles(0, 'PRACTICE_QUIZ', courseFour, 'de'),
        titlesEN: getExpectedTitles(0, 'PRACTICE_QUIZ', courseFour, 'en'),
        titlesFR: getExpectedTitles(0, 'PRACTICE_QUIZ', courseFour, 'fr'),
        titlesIT: getExpectedTitles(0, 'PRACTICE_QUIZ', courseFour, 'it'),
      },
      {
        course: courseFour,
        activityTypeKey: 'micro-learning',
        titlesDE: getExpectedTitles(0, 'MICRO_LEARNING', courseFour, 'de'),
        titlesEN: getExpectedTitles(0, 'MICRO_LEARNING', courseFour, 'en'),
        titlesFR: getExpectedTitles(0, 'MICRO_LEARNING', courseFour, 'fr'),
        titlesIT: getExpectedTitles(0, 'MICRO_LEARNING', courseFour, 'it'),
      },
      {
        course: courseFive,
        activityTypeKey: 'live-quiz',
        titlesDE: getExpectedTitles(1, 'LIVE_QUIZ', courseFive, 'de'),
        titlesEN: getExpectedTitles(1, 'LIVE_QUIZ', courseFive, 'en'),
        titlesFR: getExpectedTitles(1, 'LIVE_QUIZ', courseFive, 'fr'),
        titlesIT: getExpectedTitles(1, 'LIVE_QUIZ', courseFive, 'it'),
      },
      {
        course: courseFive,
        activityTypeKey: 'practice-quiz',
        titlesDE: getExpectedTitles(0, 'PRACTICE_QUIZ', courseFive, 'de'),
        titlesEN: getExpectedTitles(0, 'PRACTICE_QUIZ', courseFive, 'en'),
        titlesFR: getExpectedTitles(0, 'PRACTICE_QUIZ', courseFive, 'fr'),
        titlesIT: getExpectedTitles(0, 'PRACTICE_QUIZ', courseFive, 'it'),
      },
      {
        course: courseFive,
        activityTypeKey: 'micro-learning',
        titlesDE: getExpectedTitles(0, 'MICRO_LEARNING', courseFive, 'de'),
        titlesEN: getExpectedTitles(0, 'MICRO_LEARNING', courseFive, 'en'),
        titlesFR: getExpectedTitles(0, 'MICRO_LEARNING', courseFive, 'fr'),
        titlesIT: getExpectedTitles(0, 'MICRO_LEARNING', courseFive, 'it'),
      },
    ]

    for (const course of courses) {
      const courseId = course.course.id
      const activityTypeKey = course.activityTypeKey
      let response = await request(app)
        .post(`/api/configuration/course/${courseId}/${activityTypeKey}`)
        .set('X-API-Key', API_KEY)
        .set('Content-Type', 'application/json')
        .send({
          identityMappingIdentifier: course.course.owner.providerAccountId,
        })

      expect(response.status).toBe(StatusCode.SUCCESS)
      expect(response.body).toHaveProperty('activities')
      expect(response.body).toHaveProperty('timestamp')
      expect(
        response.body.activities.map((activity: any) => activity['title_de'])
      ).toEqual(expect.arrayContaining(['Übersicht', ...course.titlesDE]))
      expect(
        response.body.activities.map((activity: any) => activity['title_en'])
      ).toEqual(expect.arrayContaining(['Overview', ...course.titlesEN]))
      expect(
        response.body.activities.map((activity: any) => activity['title_fr'])
      ).toEqual(expect.arrayContaining(["Vue d'ensemble", ...course.titlesFR]))
      expect(
        response.body.activities.map((activity: any) => activity['title_it'])
      ).toEqual(expect.arrayContaining(['Panoramica', ...course.titlesIT]))
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
        'manage-account',
        'docs',
        'course-leaderboard',
      ]
      for (const activityTypeGeneral of activityTypesGeneral) {
        let response = await request(app)
          .post(`/api/configuration/course/${courseId}/${activityTypeGeneral}`)
          .set('X-API-Key', API_KEY)
          .set('Content-Type', 'application/json')
          .send({
            identityMappingIdentifier: course.owner.providerAccountId,
          })

        expect(response.status).toBe(StatusCode.BAD_REQUEST)
        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toBe('Invalid activityTypeKey')
      }
    }
  })

  test('Invalid courseId', async () => {
    const response = await request(app)
      .post('/api/configuration/course/invalid-course-id/live-quiz')
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: userOne.providerAccountId })

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid courseID')
  })

  test('Invalid activityTypeKey', async () => {
    let response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/invalid-activity-type`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: courseOne.owner.providerAccountId })

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid activityTypeKey')
  })

  test('Course/Account not found', async () => {
    let response = await request(app)
      .post(
        '/api/configuration/course/00000000-0000-0000-0000-000000000000/live-quiz'
      )
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: userOne.providerAccountId })

    expect(response.status).toBe(StatusCode.NOT_FOUND)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Course or account not found')

    response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/live-quiz`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: '1234567890@thirdprovider.ch' })

    expect(response.status).toBe(StatusCode.NOT_FOUND)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Course or account not found')
  })

  test('Missing/Invalid providerAccount', async () => {
    let response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/invalid-activity-type`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({})

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing providerAccountId')

    response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/live-quiz`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: 'invalid-provider-account' })

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe(
      'Extraction of provider from providerAccountId failed'
    )
  })

  test('Missing/Invalid API key', async () => {
    let response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/live-quiz`)
      .set('X-API-Key', 'invalid-api-key')
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: courseOne.owner.providerAccountId })

    expect(response.status).toBe(StatusCode.UNAUTHORIZED)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Invalid API key')

    response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/live-quiz`)
      .set('Content-Type', 'application/json')
      .send({ identityMappingIdentifier: courseOne.owner.providerAccountId })

    expect(response.status).toBe(StatusCode.BAD_REQUEST)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Missing API key')
  })

  test('Unsupported Content-Type', async () => {
    const response = await request(app)
      .post(`/api/configuration/course/${courseOne.id}/live-quiz`)
      .set('X-API-Key', API_KEY)
      .set('Content-Type', 'application/pdf')
      .send(
        JSON.stringify({ identityMappingIdentifier: userOne.providerAccountId })
      )

    expect(response.status).toBe(StatusCode.UNSUPPORTED_MEDIA_TYPE)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toBe('Unsupported content type')
  })

  describe('OLAT-API general', () => {
    test('/health', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(StatusCode.SUCCESS)
      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body.status).toBe('OK')
    })

    test('Rate Limit', async () => {
      const requests = []

      for (let i = 0; i < 200; i++) {
        requests.push(request(app).get('/health'))
      }

      const responses = await Promise.all(requests)

      const rateLimitedResponses = responses.filter(
        (r) => r.status === StatusCode.TOO_MANY_REQUESTS
      )

      // Check rate limit response
      const rateLimitedResponse = rateLimitedResponses[0]!
      expect(rateLimitedResponse.body).toHaveProperty('error')
      expect(rateLimitedResponse.body.error).toBe(
        'Too many requests, please try again later'
      )
    })
  })
})
