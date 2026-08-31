import { prisma } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  ElementInstanceType,
  ElementType,
} from '@klicker-uzh/prisma/client'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applyQuestionResponseInTransaction } from '../src/services/questionResponsePersistence.js'

const TEST_PREFIX = `question-response-persistence-${Date.now()}`

type Fixture = Awaited<ReturnType<typeof createFixture>>
let fixture: Fixture

async function createFixture() {
  const suffix = crypto.randomUUID()
  const lecturer = await prisma.user.create({
    data: {
      shortname: `${TEST_PREFIX}-lecturer-${suffix}`,
      email: `${TEST_PREFIX}-lecturer-${suffix}@example.org`,
    },
  })
  const courseData = {
    startDate: new Date(),
    endDate: new Date(Date.now() + 3_600_000),
    groupDeadlineDate: new Date(),
    authType: CourseAuthType.SSO,
    ownerId: lecturer.id,
  }
  const course = await prisma.course.create({
    data: {
      ...courseData,
      name: `${TEST_PREFIX}-course-${suffix}`,
      displayName: 'Question response persistence test',
    },
  })
  const otherCourse = await prisma.course.create({
    data: {
      ...courseData,
      name: `${TEST_PREFIX}-other-course-${suffix}`,
      displayName: 'Other question response persistence test course',
    },
  })
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-participant-${suffix}`,
      password: 'not-used',
      isActive: true,
      participations: { create: { courseId: course.id, isActive: true } },
    },
  })
  const participation = await prisma.participation.findUniqueOrThrow({
    where: {
      courseId_participantId: {
        courseId: course.id,
        participantId: participant.id,
      },
    },
    include: { participant: true },
  })
  const answerCollection = await prisma.answerCollection.create({
    data: {
      name: `${TEST_PREFIX}-answers-${suffix}`,
      description: 'Synthetic answers for question response persistence',
      ownerId: lecturer.id,
      entries: { create: [{ value: 'first' }, { value: 'second' }] },
    },
    include: { entries: true },
  })
  const [firstEntry, secondEntry] = answerCollection.entries
  if (!firstEntry || !secondEntry) {
    throw new Error('Question response persistence fixture has no answers')
  }

  const [choices, numerical, selection, caseStudy] = await Promise.all([
    prisma.element.create({
      data: {
        name: `${TEST_PREFIX}-choices-${suffix}`,
        content: 'Choose the first answer.',
        type: ElementType.SC,
        options: {
          hasSampleSolution: true,
          hasAnswerFeedbacks: false,
          displayMode: 'LIST',
          choices: [
            { ix: 0, value: 'correct', correct: true },
            { ix: 1, value: 'incorrect', correct: false },
          ],
        },
        ownerId: lecturer.id,
      },
    }),
    prisma.element.create({
      data: {
        name: `${TEST_PREFIX}-numerical-${suffix}`,
        content: 'Enter 42.',
        type: ElementType.NUMERICAL,
        options: { hasSampleSolution: true, exactSolutions: [42] },
        ownerId: lecturer.id,
      },
    }),
    prisma.element.create({
      data: {
        name: `${TEST_PREFIX}-selection-${suffix}`,
        content: 'Select the first entry.',
        type: ElementType.SELECTION,
        options: { hasSampleSolution: true, numberOfInputs: 1 },
        ownerId: lecturer.id,
        answerCollectionId: answerCollection.id,
        answerCollectionItems: { connect: { id: firstEntry.id } },
      },
    }),
    prisma.element.create({
      data: {
        name: `${TEST_PREFIX}-case-study-${suffix}`,
        content: 'Rate the case.',
        type: ElementType.CASE_STUDY,
        options: {
          hasSampleSolution: false,
          criteria: [
            {
              id: 'criterion-1',
              name: 'Rating',
              order: 0,
              min: 1,
              max: 5,
              step: 1,
            },
          ],
          cases: [
            {
              id: 'case-1',
              title: 'Synthetic case',
              description: 'Synthetic case for persistence coverage.',
              order: 0,
            },
          ],
        },
        ownerId: lecturer.id,
        answerCollectionId: answerCollection.id,
        answerCollectionItems: { connect: { id: secondEntry.id } },
      },
    }),
  ])

  const sourceElements = await prisma.element.findMany({
    where: {
      id: { in: [choices.id, numerical.id, selection.id, caseStudy.id] },
    },
    include: {
      answerCollection: { include: { entries: true } },
      answerCollectionItems: true,
    },
  })
  const elementsById = new Map(
    sourceElements.map((element) => [element.id, element])
  )

  async function createInstance(elementId: number) {
    const element = elementsById.get(elementId)
    if (!element)
      throw new Error('Missing question response persistence element')
    const elementData = processElementData(element)
    return await prisma.elementInstance.create({
      data: {
        type: ElementInstanceType.LIVE_QUIZ,
        elementType: element.type,
        order: 0,
        options: { pointsMultiplier: 1 },
        elementData,
        results: getInitialInstanceResults(elementData),
        anonymousResults: getInitialInstanceResults(elementData),
        ownerId: lecturer.id,
        elementId: element.id,
        instanceStatistics: { create: {} },
      },
    })
  }

  const [
    choicesInstance,
    numericalInstance,
    selectionInstance,
    caseStudyInstance,
  ] = await Promise.all([
    createInstance(choices.id),
    createInstance(numerical.id),
    createInstance(selection.id),
    createInstance(caseStudy.id),
  ])

  return {
    course,
    otherCourse,
    participant,
    participation,
    instances: {
      choices: choicesInstance,
      numerical: numericalInstance,
      selection: selectionInstance,
      caseStudy: caseStudyInstance,
    },
    entryIds: { first: firstEntry.id, second: secondEntry.id },
  }
}

async function apply(
  input: Parameters<typeof applyQuestionResponseInTransaction>[0]
) {
  return await prisma.$transaction((transaction) =>
    applyQuestionResponseInTransaction(input, transaction)
  )
}

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await prisma.participant.deleteMany({
    where: { username: { startsWith: TEST_PREFIX } },
  })
  await prisma.user.deleteMany({
    where: { shortname: { startsWith: TEST_PREFIX } },
  })
  await prisma.$disconnect()
})

describe('applyQuestionResponseInTransaction', () => {
  const actor = () => ({ participation: fixture.participation })

  it('persists choices responses and upserts their aggregate response', async () => {
    const input = {
      id: fixture.instances.choices.id,
      courseId: fixture.course.id,
      response: {
        choices: [
          { ix: 0, selected: true },
          { ix: 1, selected: false },
        ],
      },
      answerTime: 3,
      actor: actor(),
    }

    const first = await apply(input)
    const second = await apply(input)

    expect(first?.responseDetailId).toBeTypeOf('number')
    expect(second?.responseDetailId).toBeTypeOf('number')
    const response = await prisma.questionResponse.findUniqueOrThrow({
      where: {
        participantId_elementInstanceId: {
          participantId: fixture.participant.id,
          elementInstanceId: fixture.instances.choices.id,
        },
      },
    })
    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: fixture.instances.choices.id },
    })
    expect(response).toMatchObject({
      trialsCount: 2,
      lastResponse: {
        choices: [
          { ix: 0, selected: true },
          { ix: 1, selected: false },
        ],
      },
      aggregatedResponses: { choices: { 0: 2, 1: 2 }, total: 2 },
    })
    expect(instance.results).toMatchObject({
      choices: { 0: 2, 1: 2 },
      total: 2,
    })
    expect(
      await prisma.questionResponseDetail.count({
        where: { elementInstanceId: fixture.instances.choices.id },
      })
    ).toBe(2)
  })

  it('persists numerical, selection, and case-study response shapes', async () => {
    const numerical = await apply({
      id: fixture.instances.numerical.id,
      courseId: fixture.course.id,
      response: { value: '42' },
      answerTime: 4,
      actor: actor(),
    })
    const selection = await apply({
      id: fixture.instances.selection.id,
      courseId: fixture.course.id,
      response: { selection: [fixture.entryIds.first] },
      answerTime: 5,
      actor: actor(),
    })
    const caseStudy = await apply({
      id: fixture.instances.caseStudy.id,
      courseId: fixture.course.id,
      response: {
        assessment: [
          {
            caseId: 'case-1',
            itemResponses: [
              {
                itemId: fixture.entryIds.second,
                criterionResponses: [
                  { criterionId: 'criterion-1', response: 3 },
                ],
              },
            ],
          },
        ],
      },
      answerTime: 6,
      actor: actor(),
    })

    expect(numerical?.responseDetailId).toBeTypeOf('number')
    expect(selection?.responseDetailId).toBeTypeOf('number')
    expect(caseStudy?.responseDetailId).toBeTypeOf('number')
    const [numericalInstance, selectionInstance, caseStudyInstance] =
      await Promise.all([
        prisma.elementInstance.findUniqueOrThrow({
          where: { id: fixture.instances.numerical.id },
        }),
        prisma.elementInstance.findUniqueOrThrow({
          where: { id: fixture.instances.selection.id },
        }),
        prisma.elementInstance.findUniqueOrThrow({
          where: { id: fixture.instances.caseStudy.id },
        }),
      ])
    expect(numericalInstance.results).toMatchObject({ total: 1 })
    expect(selectionInstance.results).toMatchObject({
      selections: { [fixture.entryIds.first]: 1, [fixture.entryIds.second]: 0 },
      total: 1,
    })
    expect(caseStudyInstance.results).toMatchObject({
      assessments: {
        'case-1': {
          [fixture.entryIds.second]: { 'criterion-1': expect.any(Object) },
        },
      },
      total: 1,
    })
  })

  it('tracks anonymous responses without creating participant response records', async () => {
    const result = await apply({
      id: fixture.instances.numerical.id,
      courseId: fixture.course.id,
      response: { value: '17' },
      answerTime: 2,
      actor: null,
    })

    expect(result?.responseDetailId).toBeUndefined()
    const instance = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: fixture.instances.numerical.id },
    })
    expect(instance.anonymousResults).toMatchObject({ total: 1 })
    expect(
      await prisma.questionResponse.count({
        where: { elementInstanceId: fixture.instances.numerical.id },
      })
    ).toBe(1)
  })

  it('does not persist any response state when tracking is skipped', async () => {
    const before = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: fixture.instances.selection.id },
    })
    const result = await apply({
      id: fixture.instances.selection.id,
      courseId: fixture.course.id,
      response: { selection: [fixture.entryIds.second] },
      answerTime: 8,
      actor: actor(),
      skipTracking: true,
    })
    const after = await prisma.elementInstance.findUniqueOrThrow({
      where: { id: fixture.instances.selection.id },
    })

    expect(result?.responseDetailId).toBeUndefined()
    expect(after.results).toEqual(before.results)
    expect(
      await prisma.questionResponseDetail.count({
        where: { elementInstanceId: fixture.instances.selection.id },
      })
    ).toBe(1)
  })

  it('rejects actors whose participation belongs to another course', async () => {
    await expect(
      apply({
        id: fixture.instances.choices.id,
        courseId: fixture.otherCourse.id,
        response: {
          choices: [
            { ix: 0, selected: true },
            { ix: 1, selected: false },
          ],
        },
        answerTime: 1,
        actor: actor(),
      })
    ).rejects.toThrow('Question response actor does not belong to this course')
  })
})
