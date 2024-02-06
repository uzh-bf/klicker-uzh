import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  MicroSession,
  MicroSessionStatus,
  PublicationStatus,
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
              [
                ElementType.SC,
                ElementType.MC,
                ElementType.KPRIM,
                ElementType.NUMERICAL,
                ElementType.FREE_TEXT,
              ].includes(instance.questionData.type)
            ) {
              throw new Error(
                `invalid questionData.type in questionInstance ${instance.id}`
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

                      // both links will be set (to element instance and question instance) until we remove question instances completely
                      responses: {
                        connect: instance.responses.map((response) => ({
                          id: response.id,
                        })),
                      },
                      detailResponses: {
                        connect: instance.detailResponses.map((response) => ({
                          id: response.id,
                        })),
                      },
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
}

await migrate()
