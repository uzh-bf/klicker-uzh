import {
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  LearningElement,
  LearningElementStatus,
  PublicationStatus,
  QuestionInstance,
} from 'dist'
import { PrismaClient } from '../client'

function preparePracticeQuizInstanceOptions(
  learningElement: LearningElement,
  questionInstance: QuestionInstance
) {
  if (
    questionInstance.questionData.type === ElementType.SC ||
    questionInstance.questionData.type === ElementType.MC ||
    questionInstance.questionData.type === ElementType.KPRIM ||
    questionInstance.questionData.type === ElementType.NUMERICAL ||
    questionInstance.questionData.type === ElementType.FREE_TEXT
  ) {
    return {
      pointsMultiplier: questionInstance.pointsMultiplier,
      resetTimeDays: learningElement.resetTimeDays,
    }
  }

  return {}
}

function preparePracticeQuizElementData(
  learningElement: LearningElement,
  questionInstance: QuestionInstance
) {
  return {
    ...questionInstance.questionData,
  }
}

function preparePracticeQuizInstanceResults(
  learningElement: LearningElement,
  questionInstance: QuestionInstance
) {
  if (
    questionInstance.questionData.type === ElementType.SC ||
    questionInstance.questionData.type === ElementType.MC ||
    questionInstance.questionData.type === ElementType.KPRIM
  ) {
    return {
      choices:
        questionInstance.results.choices ??
        questionInstance.questionData.options.choices.map(
          (_: any, ix: number) => ({
            [`${ix}`]: 0,
          })
        ),
      total: questionInstance.participants ?? 0,
    }
  }

  if (
    questionInstance.questionData.type === ElementType.NUMERICAL ||
    questionInstance.questionData.type === ElementType.FREE_TEXT
  ) {
    return {
      responses: questionInstance.results ?? {},
      total: questionInstance.participants ?? 0,
    }
  }

  if (questionInstance.questionData.type === ElementType.FLASHCARD) {
    return {
      CORRECT: questionInstance.results?.['2'] ?? 0,
      PARTIAL: questionInstance.results?.['1'] ?? 0,
      INCORRECT: questionInstance.results?.['0'] ?? 0,
      total: questionInstance.participants ?? 0,
    }
  }
}

async function migrate() {
  const prisma = new PrismaClient()

  throw new Error('already applied to PROD')

  const initialElementInstances = await prisma.elementInstance.findMany({
    where: {
      id: {
        lte: 263,
      },
    },
  })
  for (const instance of initialElementInstances) {
    await prisma.elementInstance.update({
      where: {
        id: instance.id,
      },
      data: {
        migrationId: String(instance.id) + 'FC',
      },
    })
  }

  const elementInstances = await prisma.elementInstance.findMany({})

  for (const instance of elementInstances) {
    if (
      instance.elementData.type === ElementType.FLASHCARD &&
      Object.keys(instance.results).includes('0')
    ) {
      console.log(instance.id, instance.results)
      await prisma.elementInstance.update({
        where: {
          id: instance.id,
        },
        data: {
          results: {
            CORRECT: instance.results['2'],
            PARTIAL: instance.results['1'],
            INCORRECT: instance.results['0'],
            total: instance.results.total ?? 0,
          },
        },
      })
    }
  }

  const learningElements = await prisma.learningElement.findMany({
    include: {
      course: true,
      owner: true,
      stacks: {
        include: {
          elements: {
            include: {
              questionInstance: {
                include: {
                  question: true,
                  responses: true,
                  detailResponses: true,
                },
              },
            },
          },
        },
      },
    },
  })

  let counter = 1

  for (const elem of learningElements) {
    if (elem.courseId === null) {
      continue
    }

    const quiz = await prisma.practiceQuiz.upsert({
      where: {
        id: elem.id,
      },
      create: {
        id: elem.id,
        name: elem.name,
        displayName: elem.displayName,
        description: elem.description,
        status:
          elem.status === LearningElementStatus.PUBLISHED
            ? PublicationStatus.PUBLISHED
            : PublicationStatus.DRAFT,
        orderType:
          ((elem.orderType === 'LAST_RESPONSE' ||
            elem.orderType === 'SHUFFLED') &&
            ElementOrderType.SPACED_REPETITION) ||
          ElementOrderType.SEQUENTIAL,
        pointsMultiplier: elem.pointsMultiplier,
        resetTimeDays: elem.resetTimeDays,
        createdAt: elem.createdAt,
        updatedAt: elem.updatedAt,

        course: {
          connect: {
            id: elem.course!.id,
          },
        },
        owner: {
          connect: {
            id: elem.owner.id,
          },
        },

        stacks: {
          connectOrCreate: elem.stacks.map((stack) => ({
            where: {
              type_practiceQuizId_order: {
                type: ElementStackType.PRACTICE_QUIZ,
                practiceQuizId: elem.id,
                order: stack.order as number,
              },
            },
            create: {
              type: ElementStackType.PRACTICE_QUIZ,
              order: stack.order as number,
              displayName: stack.displayName,
              description: stack.description,

              options: {},

              // connecting the stacks to the course will add them to practice mode
              course: {
                connect: {
                  id: elem.course!.id,
                },
              },

              elements: {
                connectOrCreate: stack.elements.flatMap((stackElement) => {
                  // there are no stackElement with mdContent in the PROD db, so that case can be safely ignored
                  if (stackElement.questionInstance === null) {
                    console.warn('stackElement.questionInstance is null')
                    return []
                  }

                  if (
                    !stackElement.questionInstance.question &&
                    ![
                      ElementType.SC,
                      ElementType.MC,
                      ElementType.KPRIM,
                      ElementType.NUMERICAL,
                      ElementType.FREE_TEXT,
                    ].includes(stackElement.questionInstance.questionData.type)
                  ) {
                    throw new Error(
                      'cannot determine valid question type for instance ' +
                        stackElement.questionInstance.id
                    )
                  }

                  return [
                    {
                      where: {
                        type_migrationId: {
                          type: ElementInstanceType.PRACTICE_QUIZ,
                          migrationId: String(stackElement.questionInstance.id),
                        },
                      },
                      create: {
                        migrationId: String(stackElement.questionInstance.id),
                        type: ElementInstanceType.PRACTICE_QUIZ,
                        elementType:
                          stackElement.questionInstance.question?.type ??
                          stackElement.questionInstance.questionData.type,
                        order: stackElement.order as number,
                        createdAt: stackElement.questionInstance.createdAt,
                        updatedAt: stackElement.questionInstance.updatedAt,

                        element: stackElement.questionInstance.questionId
                          ? {
                              connect: {
                                id: stackElement.questionInstance.questionId,
                              },
                            }
                          : undefined,
                        owner: {
                          connect: {
                            id: elem.owner.id,
                          },
                        },

                        options: preparePracticeQuizInstanceOptions(
                          elem,
                          stackElement.questionInstance
                        ),
                        elementData: preparePracticeQuizElementData(
                          elem,
                          stackElement.questionInstance
                        ),
                        results: preparePracticeQuizInstanceResults(
                          elem,
                          stackElement.questionInstance
                        ),
                      },
                    },
                  ]
                }),
              },
            },
          })),
        },
      },
      update: {},
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    console.log(counter)

    counter++
  }

  console.log(counter)
}

await migrate()
