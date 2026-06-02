import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementData,
  ElementResultsChoices,
  ElementResultsSelection,
} from '@klicker-uzh/types'
import {
  type PrismaTransactionClient,
  signJWT,
  updateLiveQuizBlockResultsFromCache,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import type { Redis } from 'ioredis'
import schedule from 'node-schedule'
import type { EventEmitter } from 'node:events'

const scheduledJobs: Record<string, schedule.Job> = {}

const FIRST_ACHIEVEMENT_ID = 5
const SECOND_ACHIEVEMENT_ID = 6
const THIRD_ACHIEVEMENT_ID = 7

type ScheduledTask = {
  schedule(
    date: Date,
    payload: { liveQuizId: string; blockId: number }
  ): unknown
}

export interface LiveQuizExecutionContext {
  prisma: DB.PrismaClient
  redisExec: Redis
  redisAssessmentExec: Redis
  pubSub: {
    publish(event: string, payload: unknown): unknown
  }
  emitter: EventEmitter
  user: {
    sub: string
  }
  hatchet: {
    scheduled: {
      delete(taskId: string): Promise<unknown>
    }
  }
  tasks: {
    aggregateLiveQuizBlockResultsAssessment: ScheduledTask
    aggregateLiveQuizBlockResultsStandard: ScheduledTask
  }
}

async function sendTeamsNotification({
  scope,
  text,
}: {
  scope: string
  text: string
}) {
  if (!process.env.TEAMS_WEBHOOK_URL) return null

  try {
    return await fetch(process.env.TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        '@context': 'https://schema.org/extensions',
        '@type': 'MessageCard',
        themeColor: '0076D7',
        title: scope,
        text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
      }),
    })
  } catch (error) {
    console.error('Failed to send Teams notification:', error)
    return null
  }
}

async function upsertDailyTimelineEntry({
  prisma,
  participantId,
  courseId,
  xpAwarded,
  pointsAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  courseId: string
  xpAwarded?: number
  pointsAwarded?: number
}) {
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
  })

  if (!participation) return

  await prisma.timelineEntry.upsert({
    where: {
      participationId_courseId_timestamp_type: {
        participationId: participation.id,
        courseId,
        timestamp: new Date(),
        type: DB.TimelineEntryType.DAILY,
      },
    },
    create: {
      type: DB.TimelineEntryType.DAILY,
      timestamp: new Date(),
      collectedPoints: participation.isActive ? pointsAwarded : 0,
      collectedXp: xpAwarded,
      computedAt: new Date(),
      course: {
        connect: {
          id: courseId,
        },
      },
      participation: {
        connect: {
          id: participation.id,
        },
      },
    },
    update: {
      collectedPoints:
        typeof pointsAwarded === 'number'
          ? { increment: pointsAwarded }
          : undefined,
      collectedXp:
        typeof xpAwarded === 'number' ? { increment: xpAwarded } : undefined,
      computedAt: new Date(),
    },
  })
}

function removeSolutionFromInstances({
  instances,
}: {
  instances: DB.ElementInstance[]
}) {
  return instances.map((instance) => {
    const elementData = instance.elementData
    if (
      !elementData ||
      typeof elementData !== 'object' ||
      Array.isArray(elementData)
    ) {
      return instance
    }

    switch (elementData.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              choices: elementData.options.choices.map((choice) => ({
                ix: choice.ix,
                value: choice.value,
              })),
            },
          },
        }

      case DB.ElementType.NUMERICAL:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              exactSolutions: undefined,
              solutionRanges: undefined,
            },
          },
        }

      case DB.ElementType.FREE_TEXT:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              solutions: undefined,
            },
          },
        }

      case DB.ElementType.SELECTION:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              answerCollectionSolutionIds: undefined,
            },
          },
        }

      case DB.ElementType.CASE_STUDY:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              cases: elementData.options.cases.map((caseItem) => {
                const caseWithoutSolutions = { ...caseItem }
                delete caseWithoutSolutions.solutions
                return caseWithoutSolutions
              }),
            },
          },
        }

      default:
        return instance
    }
  })
}

export async function startLiveQuiz(
  { id }: { id: string },
  ctx: LiveQuizExecutionContext
) {
  try {
    const quiz = await ctx.prisma.liveQuiz.findFirst({
      where: {
        id,
        status: {
          in: [
            DB.PublicationStatus.DRAFT,
            DB.PublicationStatus.SCHEDULED,
            DB.PublicationStatus.PUBLISHED,
          ],
        },
      },
      include: { blocks: { orderBy: { id: 'asc' } } },
    })

    if (!quiz) {
      return null
    }

    const redis = quiz.isAssessmentEnabled
      ? ctx.redisAssessmentExec
      : ctx.redisExec

    switch (quiz.status) {
      case DB.PublicationStatus.PUBLISHED:
        return quiz

      case DB.PublicationStatus.DRAFT:
      case DB.PublicationStatus.SCHEDULED: {
        try {
          const pipeline = redis.pipeline()
          pipeline.hmset(`lq:${quiz.id}:meta`, {
            namespace: quiz.namespace,
            startedAt: Number(new Date()),
            isGamificationEnabled: quiz.isGamificationEnabled,
            isAssessmentEnabled: quiz.isAssessmentEnabled,
          })

          await pipeline.exec()
        } catch (error) {
          console.error(error)
        }

        if (quiz.scheduledPublicationTaskId) {
          try {
            await ctx.hatchet.scheduled.delete(quiz.scheduledPublicationTaskId)
          } catch (error) {
            console.error(
              `Failed to delete scheduled task for live quiz ${id}:`,
              error
            )
          }
        }

        const startedLiveQuiz = await ctx.prisma.liveQuiz.update({
          where: { id },
          data: {
            status: DB.PublicationStatus.PUBLISHED,
            startedAt: new Date(),
            scheduledPublicationTaskId: null,
          },
        })

        await sendTeamsNotification({
          scope: 'graphql/startLiveQuiz',
          text: `START Live quiz ${quiz.name} with id ${quiz.id}.`,
        })

        return startedLiveQuiz
      }
    }

    return null
  } catch (error) {
    await sendTeamsNotification({
      scope: 'graphql/startLiveQuiz',
      text: `ERROR - failed to start live quiz: ${error}`,
    })
    throw error
  }
}

export async function activateLiveQuizBlock(
  { quizId, blockId }: { quizId: string; blockId: number },
  ctx: LiveQuizExecutionContext
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: { blocks: { orderBy: { id: 'asc' } } },
  })

  if (!quiz) return null

  const newBlock = quiz.blocks.find((block) => block.id === blockId)

  if (!newBlock || quiz.activeBlockId === blockId) return quiz

  const updatedQuiz = await ctx.prisma.liveQuiz.update({
    where: { id: quizId },
    data: {
      activeBlock: { connect: { id: blockId } },
      blocks: {
        update: {
          where: { id: blockId },
          data: {
            status: DB.ElementBlockStatus.ACTIVE,
            startedAt: new Date(),
            expiresAt: newBlock.timeLimit
              ? dayjs().add(newBlock.timeLimit, 'seconds').toDate()
              : undefined,
          },
        },
      },
    },
    include: {
      activeBlock: { include: { elements: { orderBy: { order: 'asc' } } } },
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (updatedQuiz.activeBlock?.expiresAt) {
    scheduledJobs[blockId] = schedule.scheduleJob(
      dayjs(updatedQuiz.activeBlock.expiresAt).add(10, 'second').toDate(),
      async () => {
        await deactivateLiveQuizBlock({ quizId, blockId }, ctx, true)
        ctx.emitter.emit('invalidate', {
          typename: 'LiveQuiz',
          id: updatedQuiz.id,
        })
      }
    )
  }

  ctx.pubSub.publish('runningLiveQuizUpdated', {
    id: updatedQuiz.id,
    beforeFirstBlock: false,
    activeBlock: {
      ...updatedQuiz.activeBlock,
      elements: updatedQuiz.activeBlock!.elements
        ? await Promise.all(
            removeSolutionFromInstances({
              instances: updatedQuiz.activeBlock!.elements,
            }).map(async (instance) => {
              if (!quiz.isAssessmentEnabled) {
                return instance
              }

              const correlationKey = await signJWT(
                {
                  instanceId: instance.id,
                  execution: updatedQuiz.activeBlock!.execution,
                  liveQuizId: quiz.id,
                  sub: '',
                },
                process.env.APP_SECRET as string,
                {
                  issuer: process.env.APP_ORIGIN_ASSESSMENT_API,
                  issuedAt: updatedQuiz.activeBlock?.startedAt ?? new Date(0),
                }
              )

              return { ...instance, correlationKey }
            })
          )
        : [],
    },
    blocks: updatedQuiz.blocks.map((block) => ({
      ...block,
      elements:
        block.status === DB.ElementBlockStatus.EXECUTED
          ? removeSolutionFromInstances({ instances: block.elements })
          : [],
    })),
  })

  const redisMulti = updatedQuiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec.pipeline()
    : ctx.redisExec.pipeline()

  updatedQuiz.activeBlock!.elements.forEach((instance) => {
    const elementData = instance.elementData as ElementData

    const commonInfo = {
      namespace: updatedQuiz.namespace,
      startedAt: Number(new Date()),
      sessionBlockId: blockId,
      liveQuizId: updatedQuiz.id,
      courseId: updatedQuiz.courseId ?? '',
      type: elementData.type,
      basePoints: instance.options.basePoints,
      pointsMultiplier: instance.options.pointsMultiplier,
      defaultPoints: updatedQuiz.defaultPoints,
      defaultCorrectPoints: updatedQuiz.defaultCorrectPoints,
      maxBonusPoints: updatedQuiz.maxBonusPoints,
      timeToZeroBonus: updatedQuiz.timeToZeroBonus,
      blockExecution: updatedQuiz.activeBlock!.execution,
      blockStartedAt: Number(updatedQuiz.activeBlock!.startedAt),
    }

    switch (elementData.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          choiceCount: elementData.options.choices.length,
          solutions: elementData.options.hasSampleSolution
            ? JSON.stringify(
                elementData.options.choices
                  .map((choice, ix) => ({ ix, correct: choice.correct }))
                  .filter((choice) => choice.correct)
                  .map((choice) => choice.ix)
              )
            : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
          ...(instance.results as ElementResultsChoices).choices,
        })

        break
      }

      case DB.ElementType.NUMERICAL: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          ...(elementData.options.restrictions &&
          Object.keys(elementData.options.restrictions).length > 0
            ? { restrictions: JSON.stringify(elementData.options.restrictions) }
            : {}),
          solutions:
            elementData.options.exactSolutions &&
            elementData.options.exactSolutions.length > 0
              ? JSON.stringify(elementData.options.exactSolutions)
              : elementData.options.solutionRanges
                ? JSON.stringify(elementData.options.solutionRanges)
                : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })

        break
      }

      case DB.ElementType.FREE_TEXT: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          ...(elementData.options.restrictions &&
          Object.keys(elementData.options.restrictions).length > 0
            ? { restrictions: JSON.stringify(elementData.options.restrictions) }
            : {}),
          solutions: elementData.options.hasSampleSolution
            ? JSON.stringify(elementData.options.solutions)
            : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })

        break
      }

      case DB.ElementType.SELECTION: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: JSON.stringify(
            elementData.options.answerCollectionSolutionIds
          ),
          numberOfInputs: elementData.options.numberOfInputs,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
          ...(instance.results as ElementResultsSelection).selections,
        })

        break
      }

      case DB.ElementType.CASE_STUDY: {
        const validSolutions = elementData.options.cases.every(
          (caseItem) => caseItem.solutions
        )
        const solutions =
          elementData.options.hasSampleSolution && validSolutions
            ? elementData.options.cases.map((caseItem) => ({
                caseId: caseItem.id,
                itemSolutions: caseItem.solutions,
              }))
            : undefined

        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: solutions ? JSON.stringify(solutions) : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })

        break
      }

      case DB.ElementType.CONTENT: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, commonInfo)
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })

        break
      }
    }
  })

  redisMulti.exec()
  return updatedQuiz
}

export async function deactivateLiveQuizBlock(
  { quizId, blockId }: { quizId: string; blockId: number },
  ctx: LiveQuizExecutionContext,
  isScheduled?: boolean
) {
  let isAssessmentEnabled = false
  try {
    const res = await updateLiveQuizBlockResultsFromCache({
      quizId,
      blockId,
      prisma: ctx.prisma,
      redisExec: ctx.redisExec,
      redisAssessmentExec: ctx.redisAssessmentExec,
      updateResults: true,
      updateLeaderboards: true,
    })

    if (!res) return false

    const updatedQuiz = res.updatedQuiz
    const activeInstanceIds = res.activeInstanceIds
    isAssessmentEnabled = updatedQuiz.isAssessmentEnabled

    ctx.pubSub.publish('runningLiveQuizUpdated', {
      id: updatedQuiz.id,
      beforeFirstBlock: false,
      activeBlock: null,
      blocks: updatedQuiz.blocks.map((block) => ({
        ...block,
        elements:
          block.status === DB.ElementBlockStatus.EXECUTED
            ? removeSolutionFromInstances({ instances: block.elements })
            : [],
      })),
    })

    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id: updatedQuiz.id,
    })

    if (!isScheduled && scheduledJobs[blockId]) {
      await scheduledJobs[blockId].cancel()
      delete scheduledJobs[blockId]
    }

    const updatedBlock = updatedQuiz.blocks.find(
      (block) => block.id === blockId
    )
    if (updatedBlock && updatedBlock.closedAt) {
      const redis = updatedQuiz.isAssessmentEnabled
        ? ctx.redisAssessmentExec.pipeline()
        : ctx.redisExec.pipeline()

      for (const instanceId of activeInstanceIds) {
        redis.hset(
          `lq:${updatedQuiz.id}:i:${instanceId}:info`,
          'blockClosedAt',
          Number(updatedBlock.closedAt)
        )
      }
      await redis.exec()
    }
  } catch (error: any) {
    await sendTeamsNotification({
      scope: 'graphql/deactivateLiveQuizBlock',
      text: `ERROR - failed to deactivate block ${blockId} in live quiz ${
        quizId
      } with active block ${blockId}: ${error?.message || error}`,
    })

    throw error
  }

  try {
    if (isAssessmentEnabled) {
      await ctx.tasks.aggregateLiveQuizBlockResultsAssessment.schedule(
        dayjs().add(5, 'minute').toDate(),
        { liveQuizId: quizId, blockId }
      )
    } else {
      await ctx.tasks.aggregateLiveQuizBlockResultsStandard.schedule(
        dayjs().add(5, 'minute').toDate(),
        { liveQuizId: quizId, blockId }
      )
    }
  } catch (error) {
    console.error(
      `Failed to schedule aggregation task for closed block ${blockId} in live quiz ${quizId}:`,
      error
    )
  }

  return true
}

export async function endLiveQuiz(
  { id }: { id: string },
  ctx: LiveQuizExecutionContext
) {
  const quiz = await ctx.prisma.liveQuiz.findFirst({
    where: { id },
    include: {
      course: true,
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!quiz) {
    return null
  }

  if (quiz.status === DB.PublicationStatus.ENDED) {
    return quiz
  }
  if (
    quiz.status === DB.PublicationStatus.DRAFT ||
    quiz.status === DB.PublicationStatus.SCHEDULED
  ) {
    return null
  }

  const redis = quiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec

  try {
    const quizLB = await redis.hgetall(`lq:${id}:lb`)
    const quizXP = await redis.hgetall(`lq:${id}:xp`)
    const participants: Record<string, { xp?: number; score?: number }> = {}

    Object.entries(quizXP).forEach(([id, xp]) => {
      participants[id] = {
        xp: parseInt(xp),
      }
    })
    Object.entries(quizLB).forEach(([id, score]) => {
      participants[id] = {
        ...(participants[id] ?? {}),
        score: parseInt(score),
      }
    })

    if (Object.keys(participants).length > 0) {
      let existingParticipants: {
        id: string
        score?: number
        xp?: number
        hasParticipation?: boolean
      }[] = (
        await Promise.allSettled(
          Object.entries(participants).map(async ([id, { score, xp }]) => {
            const participant = await ctx.prisma.participant.findUnique({
              where: { id },
              include: {
                participations: quiz.courseId
                  ? { where: { courseId: quiz.courseId } }
                  : undefined,
              },
            })

            if (!participant) return null

            return {
              id,
              score,
              xp,
              hasParticipation: participant.participations?.[0]?.isActive,
            }
          })
        )
      ).flatMap((result) => {
        if (result.status !== 'fulfilled' || !result.value) return []
        return [result.value]
      })

      const newAchievements: Record<string, number> = {}

      const awardAchievements =
        quiz.blocks.some((block) =>
          block.elements.some((instance) => {
            const elementData = instance.elementData as ElementData
            return instance.elementType !== DB.ElementType.CONTENT &&
              'hasSampleSolution' in elementData.options
              ? (elementData.options.hasSampleSolution ?? false)
              : false
          })
        ) &&
        existingParticipants.filter(({ score }) => typeof score !== 'undefined')
          .length >= 3

      if (awardAchievements) {
        const topScores = existingParticipants
          .filter(({ score }) => typeof score !== 'undefined')
          .sort((a, b) => Number(b.score) - Number(a.score))
          .slice(0, 3)

        const firstRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: FIRST_ACHIEVEMENT_ID },
        })
        const secondRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: SECOND_ACHIEVEMENT_ID },
        })
        const thirdRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: THIRD_ACHIEVEMENT_ID },
        })

        const goldScore = topScores[0]?.score
        const silverScore = topScores[1]?.score
        const bronzeScore = topScores[2]?.score

        existingParticipants = existingParticipants.map((participant) => {
          if (
            typeof participant.score === 'undefined' ||
            typeof participant.xp === 'undefined'
          ) {
            return participant
          }

          if (participant.score === goldScore) {
            participant.xp += firstRankAchievement!.rewardedXP ?? 0
            participant.score += firstRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = firstRankAchievement!.id
          }
          if (participant.score === silverScore && silverScore !== goldScore) {
            participant.xp += secondRankAchievement!.rewardedXP ?? 0
            participant.score += secondRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = secondRankAchievement!.id
          }
          if (
            participant.score === bronzeScore &&
            bronzeScore !== silverScore
          ) {
            participant.xp += thirdRankAchievement!.rewardedXP ?? 0
            participant.score += thirdRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = thirdRankAchievement!.id
          }

          return participant
        })
      }

      await ctx.prisma.$transaction(async (prisma) => {
        for (const participant of existingParticipants) {
          if (typeof participant.xp !== 'undefined') {
            await prisma.participant.update({
              where: { id: participant.id },
              data: { xp: { increment: Number(participant.xp) } },
            })
          }
        }

        await prisma.temporaryLeaderboardEntry.deleteMany({
          where: {
            quizId: id,
            score: 0,
            createdAt: {
              equals: prisma.temporaryLeaderboardEntry.fields.updatedAt,
            },
          },
        })

        if (quizLB && quiz.courseId) {
          for (const participant of existingParticipants) {
            if (
              quiz.course?.isGamificationEnabled &&
              typeof participant.score !== 'undefined' &&
              participant.hasParticipation
            ) {
              await prisma.leaderboardEntry.upsert({
                where: {
                  type_participantId_courseId: {
                    type: DB.LeaderboardType.COURSE,
                    courseId: quiz.courseId,
                    participantId: participant.id,
                  },
                },
                include: {
                  participation: true,
                  participant: true,
                },
                create: {
                  type: DB.LeaderboardType.COURSE,
                  course: { connect: { id: quiz.courseId } },
                  participant: { connect: { id: participant.id } },
                  participation: {
                    connectOrCreate: {
                      where: {
                        courseId_participantId: {
                          courseId: quiz.courseId,
                          participantId: participant.id,
                        },
                      },
                      create: {
                        course: { connect: { id: quiz.courseId } },
                        participant: { connect: { id: participant.id } },
                      },
                    },
                  },
                  score: participant.score,
                },
                update: {
                  score: { increment: participant.score },
                },
              })
            }

            if (
              typeof participant.xp !== 'undefined' ||
              (typeof participant.score !== 'undefined' &&
                participant.hasParticipation)
            ) {
              await upsertDailyTimelineEntry({
                prisma,
                participantId: participant.id,
                courseId: quiz.courseId,
                xpAwarded: participant.xp,
                pointsAwarded: participant.hasParticipation
                  ? participant.score
                  : undefined,
              })
            }

            if (typeof newAchievements[participant.id] !== 'undefined') {
              await prisma.participant.update({
                where: { id: participant.id },
                data: {
                  achievements: {
                    upsert: {
                      where: {
                        participantId_achievementId: {
                          participantId: participant.id,
                          achievementId: newAchievements[participant.id]!,
                        },
                      },
                      create: {
                        achievedAt: new Date(),
                        achievedCount: 1,
                        achievement: {
                          connect: { id: newAchievements[participant.id]! },
                        },
                      },
                      update: {
                        achievedCount: { increment: 1 },
                      },
                    },
                  },
                },
              })
            }
          }
        }
      })
    }

    const endedLiveQuiz = await ctx.prisma.liveQuiz.update({
      where: { id },
      data: {
        status: DB.PublicationStatus.ENDED,
        finishedAt: new Date(),
      },
    })

    await sendTeamsNotification({
      scope: 'graphql/endLiveQuiz',
      text: `END Live quiz ${quiz.name} with id ${quiz.id}.`,
    })

    return endedLiveQuiz
  } catch (error) {
    await sendTeamsNotification({
      scope: 'graphql/endLiveQuiz',
      text: `ERROR - failed to end live quiz ${quiz.name} with id ${quiz.id}: ${error}`,
    })
    throw error
  }
}
