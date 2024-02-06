import {
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  LearningElement,
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
  return {
    ...questionInstance.results,
  }
}

async function migrate() {
  const prisma = new PrismaClient()

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
    console.log(counter, elem.id, elem)

    if (elem.courseId === null) {
      continue
    }

    // create a new practice quiz
    const quiz = await prisma.practiceQuiz.upsert({
      where: {
        id: elem.id,
      },
      create: {
        id: elem.id,
        name: elem.name,
        displayName: elem.displayName,
        description: elem.description,
        status: elem.status,
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
                type: 'PRACTICE_QUIZ',
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
                  console.log(stack.id, stackElement.order)

                  // there are no stackElement with mdContent in the PROD db, so that case can be safely ignored
                  if (stackElement.questionInstance === null) {
                    console.warn('stackElement.questionInstance is null')
                    return []
                  }

                  return [
                    {
                      where: {
                        type_migrationId: {
                          type: ElementInstanceType.PRACTICE_QUIZ,
                          migrationId: stackElement.questionInstance.id,
                        },
                      },
                      create: {
                        migrationId: stackElement.questionInstance.id,
                        type: ElementInstanceType.PRACTICE_QUIZ,
                        elementType:
                          stackElement.questionInstance.questionData.type,
                        order: stackElement.order as number,
                        createdAt: stackElement.questionInstance.createdAt,
                        updatedAt: stackElement.questionInstance.updatedAt,

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

                        // both links will be set (to element instance and question instance) until we remove question instances completely
                        responses: {
                          connect: stackElement.questionInstance.responses.map(
                            (response) => ({ id: response.id })
                          ),
                        },
                        detailResponses: {
                          connect:
                            stackElement.questionInstance.detailResponses.map(
                              (response) => ({ id: response.id })
                            ),
                        },
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

    console.log(counter, quiz)

    counter++
  }

  console.log(counter)
}

await migrate()
