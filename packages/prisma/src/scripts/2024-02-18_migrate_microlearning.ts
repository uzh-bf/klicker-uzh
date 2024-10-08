import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  MicroSession,
  MicroSessionStatus,
  PublicationStatus,
  QuestionInstance,
} from 'dist'
import * as R from 'ramda'
import { PrismaClient } from '../client'

function prepareMicrolearningInstanceOptions(
  microSession: MicroSession,
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
    }
  }

  return {}
}

function prepareMicrolearningElementData(
  microSession: MicroSession,
  questionInstance: QuestionInstance
) {
  return {
    ...R.omit(['questionId'], questionInstance.questionData),
    elementId: questionInstance.questionId,
  }
}

function prepareMicrolearningInstanceResults(
  microSession: MicroSession,
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

  const microSessions = await prisma.microSession.findMany({
    include: {
      course: true,
      owner: true,
      instances: {
        include: {
          responses: true,
          detailResponses: true,
          question: true,
        },
      },
    },
  })

  let counter = 1

  for (const elem of microSessions) {
    console.log(counter, elem.id, elem)

    if (elem.courseId === null) {
      continue
    }

    const quiz = await prisma.microLearning.upsert({
      where: {
        id: elem.id,
      },
      create: {
        id: elem.id,
        name: elem.name,
        displayName: elem.displayName,
        description: elem.description,
        status:
          elem.status === MicroSessionStatus.PUBLISHED
            ? PublicationStatus.PUBLISHED
            : PublicationStatus.DRAFT,
        pointsMultiplier: elem.pointsMultiplier,
        scheduledStartAt: elem.scheduledStartAt,
        scheduledEndAt: elem.scheduledEndAt,
        arePushNotificationsSent: elem.arePushNotificationsSent,
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
          connectOrCreate: elem.instances.map((instance, ix) => {
            if (
              !instance.question &&
              ![
                ElementType.SC,
                ElementType.MC,
                ElementType.KPRIM,
                ElementType.NUMERICAL,
                ElementType.FREE_TEXT,
              ].includes(instance.questionData.type)
            ) {
              throw new Error(
                'cannot determine valid question type for instance ' +
                  instance.id
              )
            }

            return {
              where: {
                type_microLearningId_order: {
                  type: ElementStackType.MICROLEARNING,
                  microLearningId: elem.id,
                  order: instance.order ?? ix,
                },
              },
              create: {
                type: ElementStackType.MICROLEARNING,
                order: instance.order ?? ix,

                options: {},

                elements: {
                  connectOrCreate: {
                    where: {
                      type_migrationId: {
                        type: ElementInstanceType.MICROLEARNING,
                        migrationId: String(instance.id),
                      },
                    },
                    create: {
                      migrationId: String(instance.id),
                      type: ElementInstanceType.MICROLEARNING,
                      elementType:
                        instance.question?.type ?? instance.questionData.type,
                      order: instance.order ?? ix,
                      createdAt: instance.createdAt,
                      updatedAt: instance.updatedAt,

                      element: instance.questionId
                        ? {
                            connect: {
                              id: instance.questionId,
                            },
                          }
                        : undefined,
                      owner: {
                        connect: {
                          id: elem.owner.id,
                        },
                      },

                      options: prepareMicrolearningInstanceOptions(
                        elem,
                        instance
                      ),
                      elementData: prepareMicrolearningElementData(
                        elem,
                        instance
                      ),
                      results: prepareMicrolearningInstanceResults(
                        elem,
                        instance
                      ),
                    },
                  },
                },
              },
            }
          }),
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

  const questionInstances = await prisma.questionInstance.findMany({
    where: {
      type: 'MICRO_SESSION',
    },
    include: {
      microSession: {
        include: {
          course: true,
        },
      },
    },
  })

  console.log('questionInstances', questionInstances.length)

  counter = 0
  let counter2 = 0
  let counter3 = 0

  for (const elem of questionInstances) {
    const matchingElementInstance = await prisma.elementInstance.findFirst({
      where: {
        migrationId: String(elem.id),
      },
    })

    if (!matchingElementInstance) {
      console.log(
        `${elem.id};${matchingElementInstance?.id};${elem.questionData.name};${matchingElementInstance?.elementData.name}`
      )
      counter2++
      continue
    }

    if (elem.questionData.name !== matchingElementInstance.elementData.name) {
      console.log(
        `${elem.id};${matchingElementInstance?.id};${elem.questionData.name};${matchingElementInstance?.elementData.name};${elem.microSession?.course?.name}`
      )
      counter3++
      continue
    }

    try {
      await prisma.questionResponse.updateMany({
        where: { questionInstanceId: elem.id },
        data: {
          elementInstanceId: matchingElementInstance?.id,
        },
      })

      await prisma.questionResponseDetail.updateMany({
        where: { questionInstanceId: elem.id },
        data: {
          elementInstanceId: matchingElementInstance?.id,
        },
      })
    } catch (e) {
      console.log('Error', e, elem.id, matchingElementInstance?.id)
      throw e
    }

    counter++
  }

  console.log(counter, counter2, counter3)
}

await migrate()
