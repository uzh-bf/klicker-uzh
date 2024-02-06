import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  MicroSession,
  QuestionInstance,
} from 'dist'
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
    ...questionInstance.questionData,
  }
}

function prepareMicrolearningInstanceResults(
  microSession: MicroSession,
  questionInstance: QuestionInstance
) {
  return {
    ...questionInstance.results,
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

    // create a new practice quiz
    const quiz = await prisma.microLearning.upsert({
      where: {
        id: elem.id,
      },
      create: {
        id: elem.id,
        name: elem.name,
        displayName: elem.displayName,
        description: elem.description,
        status: elem.status,
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
          connectOrCreate: elem.instances
            // filter old and broken instances without the order
            .filter((instance) => instance.order !== null)
            .map((instance) => ({
              where: {
                type_microLearningId_order: {
                  type: ElementStackType.MICROLEARNING,
                  microLearningId: elem.id,
                  order: instance.order as number,
                },
              },
              create: {
                type: ElementStackType.MICROLEARNING,
                order: instance.order as number,

                options: {},

                elements: {
                  connectOrCreate: {
                    where: {
                      type_migrationId: {
                        type: ElementInstanceType.MICROLEARNING,
                        migrationId: instance.id,
                      },
                    },
                    create: {
                      migrationId: instance.id,
                      type: ElementInstanceType.MICROLEARNING,
                      elementType: instance.questionData.type,
                      order: instance.order as number,
                      createdAt: instance.createdAt,
                      updatedAt: instance.updatedAt,

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

                      // TODO: add the link to responses and detailResponses
                      // both links will be set (to element instance and question instance) until we remove question instances completely
                      // responses: {
                      //   connect: stackElement.questionInstance.responses,
                      // },
                      // detailResponses: {
                      //   connect:
                      //     stackElement.questionInstance.detailResponses,
                      // },

                      owner: {
                        connect: {
                          id: elem.owner.id,
                        },
                      },
                    },
                  },
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
