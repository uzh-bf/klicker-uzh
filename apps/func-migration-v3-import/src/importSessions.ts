import { InvocationContext } from '@azure/functions'
import {
  AccessMode,
  PrismaClient,
  SessionBlockStatus,
  SessionStatus,
} from '@klicker-uzh/prisma'
import { sendTeamsNotifications, sliceIntoChunks } from './utils'

const getSessionBlockStatus = (status: string) => {
  switch (status) {
    case 'PLANNED':
      return SessionBlockStatus.SCHEDULED
    case 'ACTIVE':
      return SessionBlockStatus.ACTIVE
    case 'EXECUTED':
      return SessionBlockStatus.EXECUTED
  }
}

const getSessionStatus = (status: string) => {
  switch (status) {
    case 'CREATED':
      return SessionStatus.PREPARED
    case 'COMPLETED':
      return SessionStatus.COMPLETED
  }
}

export const importSessions = async (
  prisma: PrismaClient,
  importedSessions: any,
  mappedQuestionInstanceIds: Record<string, number>,
  user,
  batchSize: number,
  context: InvocationContext
) => {
  try {
    //new uuid is generated for each session -> string
    let mappedSessionIds: Record<string, string> = {}
    const sessionsInDb = await prisma.liveSession.findMany()
    const sessionsDict: Record<string, any> = sessionsInDb.reduce((acc, s) => {
      if (s.originalId != null) {
        acc[s.originalId] = s
      }
      return acc
    }, {})

    const batches = sliceIntoChunks(importedSessions, 10)

    for (const batch of batches) {
      const preparedSessions = batch.flatMap((session) => {
        const sessionExists = sessionsDict[session._id]

        if (sessionExists) {
          mappedSessionIds[session._id] = sessionExists.id
          return []
        }

        return [
          {
            originalData: session,
            prismaData: {
              data: {
                originalId: session._id,
                namespace: session.namespace,
                name: session.name,
                displayName: session.name, // no displayName in v2
                accessMode: session.settings.isParticipantAuthenticationEnabled
                  ? AccessMode.RESTRICTED
                  : AccessMode.PUBLIC,
                isConfusionFeedbackEnabled:
                  session.settings.isConfusionBarometerActive,
                isLiveQAEnabled: session.settings.isFeedbackChannelActive,
                isModerationEnabled: !session.settings.isFeedbackChannelPublic,
                status: getSessionStatus(session.status), // imported sessions will either be prepared or completed (no active or paused sessions)
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt),
                startedAt: session.startedAt
                  ? new Date(session.startedAt)
                  : null,
                finishedAt: session.finishedAt
                  ? new Date(session.finishedAt)
                  : null,
                // activeBlock: difference 0 and -1? e.g., -1 == nicht gestartet and 0 is first element of list? -->!! null? da keine session "running" sein wird
                // blocks: check SessionBlock -> activeInSession ?? --> NO active sessions will be imported!
                // no activeSteps in v3 -> sessions will either be prepared or completed
                // no activeInstances: QuestionInstance[] in v3 kein link da nichts mehr aktiv sein wird: sessions will either be prepared or completed
                // activeInstances? only one possible in v3? kein link da nichts mehr aktiv sein wird: sessions will either be prepared or completed
                owner: {
                  connect: {
                    id: user.id,
                  },
                },
                // nested writes for entities that have not circular dependencies
                feedbacks: !!session.isBeta
                  ? {
                      create: session.feedbacks.map((feedback) => ({
                        content: feedback.content,
                        votes: feedback.votes,
                        createdAt: new Date(feedback.createdAt),
                      })),
                    }
                  : {
                      create: session.feedbacks.map((feedback) => ({
                        isPublished: feedback.published,
                        isPinned: feedback.pinned,
                        isResolved: feedback.resolved,
                        votes: feedback.votes,
                        content: feedback.content,
                        responses: {
                          create: feedback.responses?.map((response) => ({
                            content: response.content,
                            positiveReactions: response.positiveReactions,
                            negativeReactions: response.negativeReactions,
                            createdAt: new Date(response.createdAt),
                            updatedAt: new Date(response.updatedAt),
                          })),
                        },
                        createdAt: new Date(feedback.createdAt),
                        updatedAt: new Date(feedback.updatedAt),
                      })),
                    },
                confusionFeedbacks: {
                  create: session.confusionTS.map((confusionFeedback) => ({
                    difficulty: confusionFeedback.difficulty,
                    speed: confusionFeedback.speed,
                    createdAt: new Date(confusionFeedback.createdAt),
                  })),
                },
                blocks: {
                  create: session.blocks.map((sessionBlock, blockIx) => {
                    const instances = sessionBlock.instances.map(
                      (instanceId) => ({
                        id: mappedQuestionInstanceIds[instanceId],
                      })
                    )

                    return {
                      originalId: sessionBlock._id,
                      order: blockIx,
                      randomSelection:
                        sessionBlock.randomSelection !== -1
                          ? sessionBlock.randomSelection
                          : null,
                      timeLimit:
                        sessionBlock.timeLimit !== -1
                          ? sessionBlock.timeLimit
                          : null,
                      execution:
                        sessionBlock.execution !== -1
                          ? sessionBlock.execution
                          : 0,
                      status: getSessionBlockStatus(sessionBlock.status),
                      instances: {
                        connect: instances,
                      },
                      createdAt: new Date(sessionBlock.createdAt),
                      updatedAt: new Date(sessionBlock.updatedAt),
                    }
                  }),
                },
              },
              include: {
                blocks: {
                  include: {
                    instances: true,
                  },
                },
              },
            },
          },
        ]
      })

      await Promise.allSettled(
        preparedSessions.map(async ({ originalData, prismaData }) => {
          return prisma.$transaction(async (prisma) => {
            const createdSession = await prisma.liveSession.create(prismaData)
            mappedSessionIds[createdSession.originalId] = createdSession.id

            // Update sessionBlockId of each QuestionInstance connected to the newly created SessionBlock and restore ordering of QuestionInstances
            for (const block of createdSession.blocks) {
              if (!block || !block.instances) {
                continue // skip to the next iteration if there are no instances
              }

              const reducedOldBlocks = originalData.blocks.reduce(
                (acc, block) => {
                  acc[block._id] = block
                  return acc
                },
                {}
              )

              for (const instance of block.instances) {
                const oldBlock = reducedOldBlocks[block.originalId]
                const i = oldBlock?.instances?.findIndex(
                  (id) => id === instance.originalId
                )

                let updateData = {
                  sessionBlockId: block.id,
                }

                if (i || i === 0) {
                  updateData['order'] = i
                }

                await prisma.questionInstance.update({
                  where: { id: instance.id },
                  data: updateData,
                })
              }
            }
          })
        })
      )
    }

    context.log('mappedSessionIds', mappedSessionIds)

    return mappedSessionIds
  } catch (error) {
    context.error('Something went wrong while importing sessions: ', error)
    await sendTeamsNotifications(
      'func/migration-v3-import',
      `Failed migration of sessions for user '${user.email}' because of ${error}`,
      context
    )
    throw error
  }
}
