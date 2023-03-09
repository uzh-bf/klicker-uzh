import { PrismaClient } from './client'

async function migrate() {
  const prisma = new PrismaClient()

  const learningElements = await prisma.learningElement.findMany({
    include: {
      instances: true,
    },
  })

  await prisma.$transaction(
    learningElements.map((le) =>
      prisma.learningElement.update({
        where: {
          id: le.id,
        },
        data: {
          stacks: {
            connectOrCreate: le.instances.map((instance, ix) => ({
              where: {
                type_learningElementId_order: {
                  type: 'LEARNING_ELEMENT',
                  learningElementId: le.id,
                  order: ix,
                },
              },
              create: {
                type: 'LEARNING_ELEMENT',
                order: ix,
                elements: {
                  create: {
                    order: 0,
                    questionInstance: {
                      connect: {
                        id: instance.id,
                      },
                    },
                  },
                },
              },
            })),
          },
        },
      })
    )
  )
}

migrate()
