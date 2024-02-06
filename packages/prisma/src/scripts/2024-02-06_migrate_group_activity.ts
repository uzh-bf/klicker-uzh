import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  GroupActivity,
  QuestionInstance,
} from 'dist'
import { PrismaClient } from '../client'

function prepareGroupActivityInstanceOptions(
  groupActivity: GroupActivity,
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

function prepareGroupActivityElementData(
  groupActivity: GroupActivity,
  questionInstance: QuestionInstance
) {
  return {
    ...questionInstance.questionData,
  }
}

function prepareGroupActivityInstanceResults(
  groupActivity: GroupActivity,
  questionInstance: QuestionInstance
) {
  return {
    ...questionInstance.results,
  }
}

async function migrate() {
  const prisma = new PrismaClient()

  const groupActivities = await prisma.groupActivity.findMany({
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

  for (const elem of groupActivities) {
    console.log(counter, elem.id, elem)

    if (elem.courseId === null) {
      continue
    }

    // update each group activity to add an element stack based on the question stack
    // after the migration and UI adjustments, the question stack can be removed from the model
    const groupActivity = await prisma.groupActivity.update({
      where: {
        id: elem.id,
      },
      data: {
        elementStack: {
          connectOrCreate: {
            where: {
              type_groupActivityId_order: {
                type: ElementStackType.GROUP_ACTIVITY,
                groupActivityId: elem.id,
                order: 0,
              },
            },
            create: {
              order: 0,
              type: ElementStackType.GROUP_ACTIVITY,
              options: {},

              elements: {
                connectOrCreate: elem.instances.map((instance) => ({
                  where: {
                    type_migrationId: {
                      type: ElementInstanceType.GROUP_ACTIVITY,
                      migrationId: instance.id,
                    },
                  },
                  create: {
                    migrationId: instance.id,
                    type: ElementInstanceType.GROUP_ACTIVITY,
                    elementType: instance.questionData.type,
                    order: instance.order as number,
                    createdAt: instance.createdAt,
                    updatedAt: instance.updatedAt,

                    options: prepareGroupActivityInstanceOptions(
                      elem,
                      instance
                    ),
                    elementData: prepareGroupActivityElementData(
                      elem,
                      instance
                    ),
                    results: prepareGroupActivityInstanceResults(
                      elem,
                      instance
                    ),

                    owner: {
                      connect: {
                        id: elem.owner.id,
                      },
                    },
                  },
                })),
              },
            },
          },
        },
      },
      include: {
        elementStack: {
          include: {
            elements: true,
          },
        },
      },
    })

    console.log(counter, groupActivity)

    counter++
  }

  console.log(counter)
}

await migrate()
