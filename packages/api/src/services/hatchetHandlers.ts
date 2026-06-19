import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementData,
  ElementInstanceResults,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsOpen,
  ElementResultsSelection,
  HatchetHandlers,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  updateLiveQuizBlockResultsFromCache,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import utc from 'dayjs/plugin/utc.js'
import type { Redis } from 'ioredis'
import { createHash } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import nodemailer from 'nodemailer'
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator'
import { publishMicroLearningEnded } from '../realtime/events.js'

dayjs.extend(utc)
dayjs.extend(isoWeek)

type AvailableEmailTemplate = 'RandomizedGroupCreationFailure'
type CaseStudyAssessmentResponse = Record<
  string,
  Record<string, Record<string, number | null>>
>

let transport: nodemailer.Transporter | undefined

async function createTransport() {
  if (transport) return transport

  if (process.env.EMAIL_TYPE === 'OAUTH') {
    return null
  }

  try {
    transport = nodemailer.createTransport({
      pool: true,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT
        ? parseInt(process.env.EMAIL_PORT)
        : undefined,
      secure: process.env.EMAIL_SECURE === 'true',
      requireTLS: process.env.EMAIL_STARTTLS === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    await transport.verify()
    console.log('Email transport verified')
  } catch (error) {
    console.error('Error creating email transport: ', error)
    return null
  }

  return transport
}

async function hydrateTemplate(
  {
    templateName,
    variables = {},
  }: {
    templateName: AvailableEmailTemplate
    variables?: Record<string, string>
  },
  prisma: DB.PrismaClient
) {
  let template

  try {
    template = await prisma.emailTemplate.findUnique({
      where: { name: templateName },
    })

    if (!template) return null

    template = template.html
  } catch (error) {
    console.error('Error reading email template: ', error)
    return null
  }

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`[${key}]`, value)
  }

  return template
}

async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text: string
  html: string
}) {
  const transport = await createTransport()

  if (!transport) return false

  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    })
  } catch (error) {
    console.error('Error sending email: ', error)
    return false
  }

  return true
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

interface RandomGroupAssignmentArgs {
  participantIds: string[]
  preferredGroupSize: number
}

function splitGroupsRunning({
  participantIds,
  preferredGroupSize,
}: RandomGroupAssignmentArgs) {
  if (participantIds.length >= preferredGroupSize * 2) {
    const participantIdsCopy = [...participantIds]
    const groups: string[][] = []

    while (participantIdsCopy.length >= 2 * preferredGroupSize) {
      const group = participantIdsCopy.splice(0, preferredGroupSize)
      groups.push(group)
    }

    return { groups, remainingParticipantIds: participantIdsCopy }
  }

  return { groups: [], remainingParticipantIds: participantIds }
}

function splitGroupsFinal({
  participantIds,
  preferredGroupSize,
}: RandomGroupAssignmentArgs) {
  if (participantIds.length === 1) {
    return []
  }

  let studentsInPool = participantIds.length
  if (studentsInPool % preferredGroupSize === 0) {
    const groups: string[][] = []
    while (studentsInPool > 0) {
      const group = participantIds.splice(0, preferredGroupSize)
      groups.push(group)
      studentsInPool -= preferredGroupSize
    }

    return groups
  }

  const numOfGroups = Math.floor((studentsInPool - 2) / preferredGroupSize) + 1
  const groups: string[][] = Array.from({ length: numOfGroups }, () => [])

  let groupIx = 0
  for (const participantId of participantIds) {
    groups[groupIx]!.push(participantId)
    groupIx = (groupIx + 1) % numOfGroups
  }

  return groups
}

async function createRandomGroup(
  {
    courseId,
    groupParticipantIds,
  }: { courseId: string; groupParticipantIds: string[] },
  prisma: DB.PrismaClient
) {
  const code = 100000 + Math.floor(Math.random() * 900000)
  const groupName =
    uniqueNamesGenerator({
      dictionaries: [colors, adjectives, animals],
      separator: ' ',
      style: 'capital',
    }) + 's'

  await prisma.$transaction([
    prisma.participantGroup.create({
      data: {
        randomlyAssigned: true,
        name: groupName,
        code,
        course: {
          connect: {
            id: courseId,
          },
        },
        participants: {
          connect: groupParticipantIds.map((id) => ({ id })),
        },
      },
    }),
    prisma.groupAssignmentPoolEntry.deleteMany({
      where: {
        courseId,
        participantId: {
          in: groupParticipantIds,
        },
      },
    }),
  ])
}

async function resolveSingleParticipantGroups(
  {
    course,
  }: {
    course: DB.Course & {
      participantGroups: (Pick<DB.ParticipantGroup, 'id'> & {
        participants: Pick<DB.Participant, 'id'>[]
      })[]
    }
  },
  prisma: DB.PrismaClient,
  emitter: EventEmitter
) {
  const singleParticipantGroups = course.participantGroups
    .filter((group) => group.participants.length === 1)
    .map((group) => ({
      groupId: group.id,
      participantId: group.participants[0]!.id,
    }))

  const courseExtendedPool = await prisma.course.update({
    where: { id: course.id },
    data: {
      groupAssignmentPoolEntries: {
        create: singleParticipantGroups.map(({ participantId }) => ({
          participant: {
            connect: { id: participantId },
          },
        })),
      },
      participantGroups: {
        deleteMany: {
          id: {
            in: singleParticipantGroups.map(({ groupId }) => groupId),
          },
        },
      },
    },
    include: {
      groupAssignmentPoolEntries: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  singleParticipantGroups.forEach(({ groupId }) => {
    emitter.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })
  })

  return courseExtendedPool
}

async function removeCacheEntriesBlock({
  liveQuizId,
  blockId,
  block,
  isLastBlock,
  redis,
}: {
  liveQuizId: string
  blockId: number
  block: DB.ElementBlock & { elements: DB.ElementInstance[] }
  isLastBlock: boolean
  redis: Redis
}) {
  if (isLastBlock) {
    const keys = await redis.keys(`lq:${liveQuizId}:*`)
    if (keys.length > 0) {
      const pipe = redis.pipeline()
      for (const key of keys) {
        pipe.expire(key, 60 * 60 * 24)
      }
      await pipe.exec()
    }
  } else {
    const instanceIds = block.elements.map((instance) => instance.id)
    const instanceKeysNested = await Promise.all(
      instanceIds.map(
        async (id) => await redis.keys(`lq:${liveQuizId}:i:${id}:*`)
      )
    )
    const instanceKeys = instanceKeysNested.flat()
    const blockKeys = await redis.keys(`lq:${liveQuizId}:b:${blockId}:*`)
    const keys = [...instanceKeys, ...blockKeys]

    if (keys.length > 0) {
      const pipe = redis.pipeline()
      for (const key of keys) {
        pipe.expire(key, 60 * 60 * 24)
      }
      await pipe.exec()
    }
  }
}

function aggregateLiveQuizResponses({
  responses,
  elementData,
}: {
  responses: DB.LiveQuizResponse[]
  elementData: ElementData
}): ElementInstanceResults {
  switch (elementData.type) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsChoices
      return responses.reduce<ElementResultsChoices>((acc, submission) => {
        if (!submission.response || !('choices' in submission.response))
          return acc

        acc.total += 1
        submission.response.choices.forEach((choice) => {
          if (choice.selected && choice.ix in acc.choices) {
            acc.choices[choice.ix] = (acc.choices[choice.ix] ?? 0) + 1
          }
        })

        return acc
      }, initialResults)
    }
    case DB.ElementType.NUMERICAL: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsOpen

      return responses.reduce<ElementResultsOpen>((acc, submission) => {
        if (!submission.response || !('value' in submission.response))
          return acc

        const cleanResponseValue = parseFloat(String(submission.response.value))
        if (!isNaN(cleanResponseValue)) {
          const MD5 = createHash('md5')
          MD5.update(String(cleanResponseValue))
          const responseHash = MD5.digest('hex')
          if (responseHash in acc.responses) {
            acc.responses[responseHash]!.count += 1
          } else {
            acc.responses[responseHash] = {
              value: String(cleanResponseValue),
              count: 1,
              correct: elementData.options.hasSampleSolution
                ? submission.correctness === DB.ResponseCorrectness.CORRECT
                : undefined,
            }
          }

          acc.total += 1
        }

        return acc
      }, initialResults)
    }
    case DB.ElementType.FREE_TEXT: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsOpen

      return responses.reduce<ElementResultsOpen>((acc, submission) => {
        if (!submission.response || !('value' in submission.response))
          return acc

        const cleanResponseValue = submission.response.value.trim()
        if (cleanResponseValue.length > 0) {
          const MD5 = createHash('md5')
          MD5.update(cleanResponseValue)
          const responseHash = MD5.digest('hex')
          if (responseHash in acc.responses) {
            acc.responses[responseHash]!.count += 1
          } else {
            acc.responses[responseHash] = {
              value: cleanResponseValue,
              count: 1,
              correct: elementData.options.hasSampleSolution
                ? submission.correctness === DB.ResponseCorrectness.CORRECT
                : undefined,
            }
          }

          acc.total += 1
        }

        return acc
      }, initialResults)
    }
    case DB.ElementType.SELECTION: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsSelection

      return responses.reduce<ElementResultsSelection>((acc, submission) => {
        if (!submission.response || !('selection' in submission.response))
          return acc

        submission.response.selection
          .filter((ix) => ix !== -1 && typeof ix !== 'undefined' && ix !== null)
          .forEach((ix) => {
            if (ix in acc.selections) {
              acc.selections[ix] = (acc.selections[ix] ?? 0) + 1
            }
          })

        acc.total += 1
        return acc
      }, initialResults)
    }
    case DB.ElementType.CASE_STUDY: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsCaseStudy

      return responses.reduce<ElementResultsCaseStudy>((acc, submission) => {
        if (!submission.response || !('assessment' in submission.response))
          return acc

        const assessment = submission.response
          .assessment as CaseStudyAssessmentResponse

        Object.entries(assessment).forEach(([caseId, itemResponses]) => {
          Object.entries(itemResponses).forEach(
            ([itemId, criterionResponses]) => {
              Object.entries(criterionResponses).forEach(
                ([criterionId, criterionResponse]) => {
                  if (
                    criterionResponse === null ||
                    typeof criterionResponse !== 'number' ||
                    typeof acc.assessments[caseId]?.[itemId]?.[criterionId] ===
                      'undefined'
                  ) {
                    return acc
                  }

                  const MD5 = createHash('md5')
                  MD5.update(String(criterionResponse))
                  const responseHash = MD5.digest('hex')

                  if (
                    acc.assessments[caseId]![itemId]![criterionId]![
                      responseHash
                    ]
                  ) {
                    acc.assessments[caseId]![itemId]![criterionId]![
                      responseHash
                    ]!.count += 1
                  } else {
                    acc.assessments[caseId]![itemId]![criterionId]![
                      responseHash
                    ] = {
                      value: criterionResponse,
                      count: 1,
                    }
                  }
                }
              )
            }
          )
        })

        acc.total += 1
        return acc
      }, initialResults)
    }
    case DB.ElementType.CONTENT: {
      return { total: responses.length }
    }
    default:
      return { total: 0 }
  }
}

async function updateWeeklyTimelineEntriesFromDailys({
  entries,
  dailyEntries,
  timestamp,
  courseId,
}: {
  entries: (DB.TimelineEntry & { participation?: DB.Participation })[]
  dailyEntries: (DB.TimelineEntry & { participation?: DB.Participation })[]
  timestamp: Date
  courseId: string
}) {
  const reducedDailyEntries = dailyEntries.reduce<{
    [participationId: string]: { collectedPoints: number; collectedXp: number }
  }>((acc, entry) => {
    if (
      entry.participationId === null ||
      typeof entry.participationId === 'undefined'
    ) {
      return acc
    }

    const participationId = String(entry.participationId)
    if (!acc[participationId]) {
      acc[participationId] = {
        collectedPoints: 0,
        collectedXp: 0,
      }
    }

    acc[participationId]!.collectedPoints += entry.participation?.isActive
      ? entry.collectedPoints
      : 0
    acc[participationId]!.collectedXp += entry.collectedXp

    return acc
  }, {})

  if (Object.keys(reducedDailyEntries).length === 0) {
    return []
  }

  return Object.entries(reducedDailyEntries).flatMap(
    ([participationId, values]) => {
      const pId = parseInt(participationId)
      const storedEntry = entries.find(
        (entry) =>
          entry.type === DB.TimelineEntryType.WEEKLY &&
          entry.timestamp.getTime() === timestamp.getTime() &&
          entry.participationId === pId
      )

      if (
        !storedEntry ||
        storedEntry.collectedPoints !== values.collectedPoints ||
        storedEntry.collectedXp !== values.collectedXp
      ) {
        return {
          where: {
            participationId_courseId_timestamp_type: {
              participationId: pId,
              courseId,
              timestamp,
              type: DB.TimelineEntryType.WEEKLY,
            },
          },
          create: {
            type: DB.TimelineEntryType.WEEKLY,
            timestamp,
            collectedPoints: values.collectedPoints,
            collectedXp: values.collectedXp,
            computedAt: new Date(),
            course: {
              connect: {
                id: courseId,
              },
            },
            participation: {
              connect: {
                id: pId,
              },
            },
          },
          update: {
            collectedPoints: values.collectedPoints,
            collectedXp: values.collectedXp,
            computedAt: new Date(),
          },
        }
      }

      return []
    }
  )
}

export async function updateWeeklyTimelineEntriesCourse(
  { courseId }: { courseId: string },
  prisma: DB.PrismaClient,
  executionCtx?: Parameters<
    HatchetHandlers['handleUpdateWeeklyTimelineEntries']
  >[2]
) {
  const startDateCurrentWeek = dayjs().utc().startOf('isoWeek').toDate()
  const startDateLastWeek = dayjs()
    .utc()
    .startOf('isoWeek')
    .subtract(7, 'days')
    .toDate()

  const courseTimelineLastWeek = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      timelineEntries: {
        where: {
          OR: [
            {
              type: DB.TimelineEntryType.DAILY,
              timestamp: { gte: startDateLastWeek, lt: startDateCurrentWeek },
            },
            { type: DB.TimelineEntryType.WEEKLY, timestamp: startDateLastWeek },
          ],
        },
        include: { participation: true },
      },
    },
  })

  const courseTimelineCurrentWeek = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      timelineEntries: {
        where: {
          OR: [
            {
              type: DB.TimelineEntryType.DAILY,
              timestamp: { gte: startDateCurrentWeek, lte: new Date() },
            },
            {
              type: DB.TimelineEntryType.WEEKLY,
              timestamp: startDateCurrentWeek,
            },
          ],
        },
        include: { participation: true },
      },
    },
  })

  if (!courseTimelineLastWeek || !courseTimelineCurrentWeek) {
    executionCtx?.logger.info(
      `[ERROR] [UpdateWeeklyTimelineEntries] Course with id ${courseId} not found`
    )

    return false
  }

  const updates: any[] = []
  let numUpdatesLastWeek = 0
  let numUpdatesCurrentWeek = 0
  const lastWeekDailys = courseTimelineLastWeek.timelineEntries.filter(
    (entry) => entry.type === DB.TimelineEntryType.DAILY
  )
  const currentWeekDailys = courseTimelineCurrentWeek.timelineEntries.filter(
    (entry) => entry.type === DB.TimelineEntryType.DAILY
  )

  if (lastWeekDailys.length > 0) {
    const lastWeekUpdates = await updateWeeklyTimelineEntriesFromDailys({
      entries: courseTimelineLastWeek.timelineEntries,
      dailyEntries: lastWeekDailys,
      timestamp: startDateLastWeek,
      courseId,
    })

    if (lastWeekUpdates.length > 0) {
      updates.push(...lastWeekUpdates)
      numUpdatesLastWeek = lastWeekUpdates.length
    }
  }

  if (currentWeekDailys.length > 0) {
    const currentWeekUpdates = await updateWeeklyTimelineEntriesFromDailys({
      entries: courseTimelineCurrentWeek.timelineEntries,
      dailyEntries: currentWeekDailys,
      timestamp: startDateCurrentWeek,
      courseId,
    })

    if (currentWeekUpdates.length > 0) {
      updates.push(...currentWeekUpdates)
      numUpdatesCurrentWeek = currentWeekUpdates.length
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(async (prisma) => {
      for (const update of updates) {
        await prisma.timelineEntry.upsert(update)
      }
    })

    executionCtx?.logger.info(
      `[INFO] [UpdateWeeklyTimelineEntries] Successfully updated ${updates.length} weekly timeline entries for course ${courseTimelineLastWeek.name} (${numUpdatesLastWeek} for last week with start date ${startDateLastWeek} and ${lastWeekDailys.length} daily entries, ${numUpdatesCurrentWeek} for the current week with start date ${startDateCurrentWeek} and ${currentWeekDailys.length} daily entries).`
    )
  }

  return true
}

export const hatchetHandlers: HatchetHandlers = {
  handleFinalRandomGroupAssignments: async (_, globalCtx, executionCtx) => {
    await executionCtx.logger.info(
      '[INFO] [FinalRandomGroupAssignments] Starting final random group assignments...'
    )

    const courses = await globalCtx.prisma.course.findMany({
      where: {
        randomAssignmentFinalized: false,
        isGroupCreationEnabled: true,
        groupDeadlineDate: {
          lte: new Date(),
        },
      },
      include: {
        groupAssignmentPoolEntries: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        participantGroups: {
          select: {
            id: true,
            participants: {
              select: {
                id: true,
              },
            },
          },
        },
        owner: true,
      },
    })

    await executionCtx.logger.info(
      `[INFO] [FinalRandomGroupAssignments] Found ${courses.length} courses with past group deadlines`
    )

    for (const course of courses) {
      try {
        const courseId = course.id
        const courseExtendedPool = await resolveSingleParticipantGroups(
          { course },
          globalCtx.prisma,
          globalCtx.emitter
        )

        await executionCtx.logger.info(
          `[INFO] [FinalRandomGroupAssignments] Resolved all single participant groups for course ${course.name} (id: ${course.id}).`
        )

        const poolParticipantIds =
          courseExtendedPool.groupAssignmentPoolEntries.map(
            (entry) => entry.participantId
          )

        if (poolParticipantIds.length === 0) {
          await globalCtx.prisma.course.update({
            where: { id: courseId },
            data: { randomAssignmentFinalized: true },
          })

          await executionCtx.logger.info(
            `[INFO] [FinalRandomGroupAssignments] Finalized random assignment for course ${course.name} (id: ${course.id}) - no participants in pool.`
          )

          continue
        }

        if (poolParticipantIds.length === 1) {
          const courseGroupsOverviewLink = `${process.env.APP_ORIGIN_MANAGE}/courses/${course.id}?gamificationTab=groups`

          const emailHtml = await hydrateTemplate(
            {
              templateName: 'RandomizedGroupCreationFailure',
              variables: {
                COURSE_NAME: course.name,
                LINK: courseGroupsOverviewLink,
              },
            },
            globalCtx.prisma
          )

          if (!emailHtml) {
            continue
          }

          await sendEmail({
            to: course.notificationEmail ?? course.owner.email,
            subject: `KlickerUZH - Group Creation for Course ${course.name}`,
            text: `The automated random group creation for your course ${course.name} has failed. Please refer to the course overview for more details and to change the group creation deadline: ${courseGroupsOverviewLink}.`,
            html: emailHtml,
          })

          await executionCtx.logger.info(
            `[INFO] [FinalRandomGroupAssignments] Failure of automatic group assignment - single participant in pool for course ${course.name} (id ${course.id}). Sent E-Mail to course owner with id ${course.ownerId}.`
          )

          await globalCtx.prisma.course.update({
            where: { id: courseId },
            data: {
              randomAssignmentFinalized: true,
            },
          })

          continue
        }

        const groups = splitGroupsFinal({
          participantIds: poolParticipantIds,
          preferredGroupSize: course.preferredGroupSize,
        })

        for (const group of groups) {
          await createRandomGroup(
            { courseId, groupParticipantIds: group },
            globalCtx.prisma
          )
        }

        await globalCtx.prisma.course.update({
          where: { id: courseId },
          data: {
            randomAssignmentFinalized: true,
          },
        })

        await executionCtx.logger.info(
          `[INFO] [FinalRandomGroupAssignments] Successfully completed final random group assignment for course ${course.name} (id ${course.id}) with ${groups.length} new groups.`
        )
      } catch (error) {
        await executionCtx.logger.error(
          `[ERROR] [FinalRandomGroupAssignments] Failed to finalize random group assignments for course ${course.name} (id: ${course.id}) with error: ${error || 'missing'}`
        )

        continue
      }
    }

    await executionCtx.logger.info(
      `[INFO] [FinalRandomGroupAssignments] Complete final random group assignment for all courses with past group formation deadlines.`
    )

    return true
  },

  handleRunningRandomGroupAssignments: async (_, globalCtx, executionCtx) => {
    await executionCtx.logger.info(
      '[INFO] [RunningRandomGroupAssignments] Starting to handle running random group assignments...'
    )

    const courses = await globalCtx.prisma.course.findMany({
      where: {
        randomAssignmentFinalized: false,
        isGroupCreationEnabled: true,
        groupDeadlineDate: { gt: new Date() },
      },
      include: {
        groupAssignmentPoolEntries: { orderBy: { createdAt: 'asc' } },
      },
    })

    await executionCtx.logger.info(
      `[INFO] [RunningRandomGroupAssignments] Found ${courses.length} courses with upcoming group deadlines`
    )

    const coursesToUpdate = courses.filter(
      (course) =>
        course.groupAssignmentPoolEntries.length >=
        2 * course.preferredGroupSize
    )

    await executionCtx.logger.info(
      `[INFO] [RunningRandomGroupAssignments] Found ${coursesToUpdate.length} courses with enough participants in the pool`
    )

    for (const course of coursesToUpdate) {
      try {
        const { participantIds, poolEntryIds } =
          course.groupAssignmentPoolEntries.reduce<{
            participantIds: string[]
            poolEntryIds: number[]
          }>(
            (acc, entry) => {
              acc.participantIds.push(entry.participantId)
              acc.poolEntryIds.push(entry.id)
              return acc
            },
            { participantIds: [], poolEntryIds: [] }
          )

        const { groups } = splitGroupsRunning({
          participantIds,
          preferredGroupSize: course.preferredGroupSize,
        })

        for (const groupParticipantIds of groups) {
          await createRandomGroup(
            { courseId: course.id, groupParticipantIds },
            globalCtx.prisma
          )
        }

        globalCtx.emitter.emit('invalidate', {
          typename: 'Course',
          id: course.id,
        })
        participantIds.forEach((participantId) => {
          globalCtx.emitter.emit('invalidate', {
            typename: 'Participant',
            id: participantId,
          })
        })
        poolEntryIds.forEach((poolEntryId) => {
          globalCtx.emitter.emit('invalidate', {
            typename: 'GroupAssignmentPoolEntry',
            id: poolEntryId,
          })
        })

        await executionCtx.logger.info(
          `[INFO] [RunningRandomGroupAssignments] Successfully assigned ${groups.length} new random groups for ${course.name} (id: ${course.id}; rolling assignment).`
        )
      } catch (error) {
        await sendTeamsNotification({
          scope: 'hatchet/running-random-group-assignments',
          text: `Failed to assign random groups for course ${course.name} (id: ${course.id}; rolling assignment) with error: ${
            error || 'missing'
          }`,
        })

        await executionCtx.logger.error(
          `[ERROR] [RunningRandomGroupAssignments] Failed to assign groups for course ${course.name} (id: ${course.id}; rolling assignment) with error: ${error || 'missing'}`
        )
      }
    }

    await executionCtx.logger.info(
      `[INFO] [RunningRandomGroupAssignments] Finished handling running random group assignments.`
    )

    return true
  },

  handleUpdateGroupAverageScores: async (_, globalCtx, executionCtx) => {
    await executionCtx.logger.info(
      '[INFO] [UpdateGroupAverageScores] Updating average group scores for all participant groups in ongoing / future courses...'
    )

    const groupsWithParticipants =
      await globalCtx.prisma.participantGroup.findMany({
        where: { course: { endDate: { gt: new Date() } } },
        include: {
          participants: {
            include: {
              leaderboards: {
                where: { type: DB.LeaderboardType.COURSE },
              },
            },
          },
        },
      })

    await executionCtx.logger.info(
      `[INFO] [UpdateGroupAverageScores] Found ${groupsWithParticipants.length} participant groups in ongoing or future courses`
    )

    try {
      await Promise.all(
        groupsWithParticipants.map((group) => {
          const aggregate = group.participants.reduce(
            (acc, participant) => {
              const matchingLeaderboard = participant.leaderboards.find(
                (item) => item.courseId === group.courseId
              )
              return {
                sum: acc.sum + (matchingLeaderboard?.score ?? 0),
                count: acc.count + 1,
              }
            },
            {
              sum: 0,
              count: 0,
            }
          )

          if (aggregate.count === 0) return Promise.resolve()

          return globalCtx.prisma.participantGroup.update({
            where: { id: group.id },
            data: {
              averageMemberScore: Math.round(aggregate.sum / aggregate.count),
            },
          })
        })
      )

      return true
    } catch (error) {
      await executionCtx.logger.error(
        `[ERROR] [UpdateGroupAverageScores] Failed to update group average scores with error: ${error || 'missing'}`
      )
      return false
    }
  },

  handleSendPushNotifications: async () => {
    if (
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY ||
      !process.env.NOTIFICATION_SUPPORT_MAIL
    ) {
      throw new Error('VAPID keys or support email not available.')
    }

    return true
  },

  handleSendTeamsNotification: async ({ scope, text }) => {
    return sendTeamsNotification({ scope, text })
  },

  handleUpdateWeeklyTimelineEntries: async (_, globalCtx, executionCtx) => {
    executionCtx.logger.info(
      `[INFO] [UpdateWeeklyTimelineEntries] Starting update of weekly timeline entries`
    )

    const courses = await globalCtx.prisma.course.findMany({
      where: { endDate: { gt: new Date() } },
      select: { id: true, name: true },
    })

    for (const course of courses) {
      await updateWeeklyTimelineEntriesCourse(
        { courseId: course.id },
        globalCtx.prisma,
        executionCtx
      )

      executionCtx.logger.info(
        `[INFO] [UpdateWeeklyTimelineEntries] Successfully updated weekly timeline entries for course ${course.name} (ID: ${course.id})`
      )
    }

    const deletedDailyEntries = await globalCtx.prisma.timelineEntry.deleteMany(
      {
        where: {
          type: DB.TimelineEntryType.DAILY,
          timestamp: {
            lt: dayjs().utc().subtract(30, 'days').toDate(),
          },
        },
      }
    )

    executionCtx.logger.info(
      `[INFO] [UpdateWeeklyTimelineEntries] Successfully removed ${deletedDailyEntries.count} daily timeline entries older than 30 days`
    )

    return true
  },

  handleEndExpiredGroupActivity: async ({ groupActivityId }, globalCtx) => {
    try {
      const groupActivity = await globalCtx.prisma.groupActivity.findUnique({
        where: {
          id: groupActivityId,
          isDeleted: false,
          status: DB.PublicationStatus.PUBLISHED,
          scheduledEndAt: { lte: new Date() },
        },
      })

      if (!groupActivity) {
        await sendTeamsNotification({
          scope: 'hatchet/group-activity-end',
          text: `Group activity with ID ${groupActivityId} not found or scheduled end time is not in the past yet.`,
        })
        throw new Error(
          `Group activity with ID ${groupActivityId} not found or scheduled end time is not in the past yet.`
        )
      }

      const updatedGroupActivity = await globalCtx.prisma.groupActivity.update({
        where: { id: groupActivityId },
        data: { status: DB.PublicationStatus.ENDED },
      })

      await sendTeamsNotification({
        scope: 'hatchet/group-activity-end',
        text: `Successfully ended expired group activity ${updatedGroupActivity.id}`,
      })

      globalCtx.pubSub.publish('groupActivityEnded', updatedGroupActivity)
      globalCtx.pubSub.publish('singleGroupActivityEnded', updatedGroupActivity)
      globalCtx.emitter.emit('invalidate', {
        typename: 'GroupActivity',
        id: updatedGroupActivity.id,
      })

      return true
    } catch (error) {
      console.error('Error ending expired group activity:', error)
      await sendTeamsNotification({
        scope: 'hatchet/group-activity-end',
        text: `Error ending group activity with ID ${groupActivityId}: ${error}`,
      })
      throw error
    }
  },

  handleEndExpiredMicroLearning: async ({ microLearningId }, globalCtx) => {
    try {
      const microLearning = await globalCtx.prisma.microLearning.findUnique({
        where: {
          id: microLearningId,
          isDeleted: false,
          status: DB.PublicationStatus.PUBLISHED,
          scheduledEndAt: { lte: new Date() },
        },
      })

      if (!microLearning) {
        await sendTeamsNotification({
          scope: 'hatchet/microlearning-end',
          text: `Microlearning with ID ${microLearningId} not found or scheduled end time is not in the past yet.`,
        })
        throw new Error(
          `Microlearning with ID ${microLearningId} not found or scheduled end time is not in the past yet.`
        )
      }

      const updatedMicroLearning = await globalCtx.prisma.microLearning.update({
        where: { id: microLearningId },
        data: { status: DB.PublicationStatus.ENDED },
      })

      await sendTeamsNotification({
        scope: 'hatchet/microlearning-end',
        text: `Successfully ended expired microlearning ${updatedMicroLearning.id}`,
      })

      publishMicroLearningEnded(globalCtx.pubSub, updatedMicroLearning)
      globalCtx.emitter.emit('invalidate', {
        typename: 'MicroLearning',
        id: updatedMicroLearning.id,
      })

      return true
    } catch (error) {
      console.error('Error ending expired microlearning:', error)
      await sendTeamsNotification({
        scope: 'hatchet/microlearning-end',
        text: `Error ending microlearning with ID ${microLearningId}: ${error}`,
      })
      throw error
    }
  },

  handlePublishScheduledLiveQuiz: async (
    { liveQuizId },
    globalCtx,
    executionCtx
  ) => {
    executionCtx.logger.info(
      `Publishing scheduled live quiz with ID ${liveQuizId}`
    )

    try {
      const liveQuiz = await globalCtx.prisma.liveQuiz.findUnique({
        where: {
          id: liveQuizId,
          isDeleted: false,
          status: DB.PublicationStatus.SCHEDULED,
          availableFrom: { lte: new Date() },
        },
      })

      if (!liveQuiz) {
        await sendTeamsNotification({
          scope: 'hatchet/live-quiz-start',
          text: `Live quiz with ID ${liveQuizId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Live quiz with ID ${liveQuizId} not found or scheduled start time is not in the past yet.`
        )
      }

      const redis = liveQuiz.isAssessmentEnabled
        ? globalCtx.redisAssessmentExec
        : globalCtx.redisExec

      await redis
        .pipeline()
        .hmset(`lq:${liveQuiz.id}:meta`, {
          namespace: liveQuiz.namespace,
          startedAt: Number(new Date()),
        })
        .exec()

      const startedLiveQuiz = await globalCtx.prisma.liveQuiz.update({
        where: { id: liveQuizId },
        data: {
          status: DB.PublicationStatus.PUBLISHED,
          startedAt: new Date(),
        },
      })

      await sendTeamsNotification({
        scope: 'hatchet/live-quiz-start',
        text: `START Live quiz ${startedLiveQuiz.name} with id ${startedLiveQuiz.id}.`,
      })

      globalCtx.emitter.emit('invalidate', {
        typename: 'LiveQuiz',
        id: startedLiveQuiz.id,
      })

      return true
    } catch (error) {
      console.error('Error publishing scheduled live quiz:', error)
      await sendTeamsNotification({
        scope: 'hatchet/live-quiz-start',
        text: `Error publishing live quiz with ID ${liveQuizId}: ${error}`,
      })
      throw error
    }
  },

  handlePublishScheduledPracticeQuiz: async ({ practiceQuizId }, globalCtx) => {
    try {
      const practiceQuiz = await globalCtx.prisma.practiceQuiz.findUnique({
        where: {
          id: practiceQuizId,
          isDeleted: false,
          status: DB.PublicationStatus.SCHEDULED,
          availableFrom: { lte: new Date() },
        },
      })

      if (!practiceQuiz) {
        await sendTeamsNotification({
          scope: 'hatchet/practice-quiz-start',
          text: `Practice quiz with ID ${practiceQuizId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Practice quiz with ID ${practiceQuizId} not found or scheduled start time is not in the past yet.`
        )
      }

      const updatedPracticeQuiz = await globalCtx.prisma.practiceQuiz.update({
        where: { id: practiceQuizId, isDeleted: false },
        data: { status: DB.PublicationStatus.PUBLISHED },
        include: { stacks: true },
      })

      await sendTeamsNotification({
        scope: 'graphql/publishScheduledPracticeQuizs',
        text: `Successfully published scheduled practice quiz ${updatedPracticeQuiz.id}`,
      })

      await globalCtx.prisma.course.update({
        where: { id: updatedPracticeQuiz.courseId },
        data: {
          elementStacks: {
            connect: updatedPracticeQuiz.stacks.map((stack) => ({
              id: stack.id,
            })),
          },
        },
      })

      globalCtx.emitter.emit('invalidate', {
        typename: 'PracticeQuiz',
        id: updatedPracticeQuiz.id,
      })

      return true
    } catch (error) {
      console.error('Error publishing scheduled practice quiz:', error)
      await sendTeamsNotification({
        scope: 'hatchet/practice-quiz-start',
        text: `Error publishing practice quiz with ID ${practiceQuizId}: ${error}`,
      })
      throw error
    }
  },

  handlePublishScheduledGroupActivity: async (
    { groupActivityId },
    globalCtx
  ) => {
    try {
      const groupActivity = await globalCtx.prisma.groupActivity.findUnique({
        where: {
          id: groupActivityId,
          scheduledStartAt: { lte: new Date() },
          status: DB.PublicationStatus.SCHEDULED,
        },
      })

      if (!groupActivity) {
        await sendTeamsNotification({
          scope: 'hatchet/group-activity-start',
          text: `Group activity with ID ${groupActivityId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Group activity with ID ${groupActivityId} not found or scheduled start time is not in the past yet.`
        )
      }

      await globalCtx.prisma.groupActivity.update({
        where: { id: groupActivityId },
        data: { status: DB.PublicationStatus.PUBLISHED },
      })

      await sendTeamsNotification({
        scope: 'graphql/publishScheduledGroupActivitys',
        text: `Successfully published scheduled group activity ${groupActivity.id}`,
      })

      globalCtx.emitter.emit('invalidate', {
        typename: 'GroupActivity',
        id: groupActivity.id,
      })

      return true
    } catch (error) {
      console.error('Error publishing scheduled group activity:', error)
      await sendTeamsNotification({
        scope: 'hatchet/group-activity-start',
        text: `Error publishing group activity with ID ${groupActivityId}: ${error}`,
      })
      throw error
    }
  },

  handlePublishScheduledMicroLearning: async (
    { microLearningId },
    globalCtx
  ) => {
    try {
      const microLearning = await globalCtx.prisma.microLearning.findUnique({
        where: {
          id: microLearningId,
          scheduledStartAt: { lte: new Date() },
          status: DB.PublicationStatus.SCHEDULED,
        },
      })

      if (!microLearning) {
        await sendTeamsNotification({
          scope: 'hatchet/microlearning-start',
          text: `Microlearning with ID ${microLearningId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Microlearning with ID ${microLearningId} not found or scheduled start time is not in the past yet.`
        )
      }

      await globalCtx.prisma.microLearning.update({
        where: { id: microLearningId },
        data: { status: DB.PublicationStatus.PUBLISHED },
      })

      await sendTeamsNotification({
        scope: 'graphql/publishScheduledMicroLearnings',
        text: `Successfully published scheduled microlearning ${microLearning.id}`,
      })

      globalCtx.emitter.emit('invalidate', {
        typename: 'MicroLearning',
        id: microLearning.id,
      })

      return true
    } catch (error) {
      console.error('Error publishing scheduled microlearning:', error)
      await sendTeamsNotification({
        scope: 'hatchet/microlearning-start',
        text: `Error publishing microlearning with ID ${microLearningId}: ${error}`,
      })
      throw error
    }
  },

  handleStandardLiveQuizBlockClosureAggregation: async (
    { liveQuizId, blockId },
    globalCtx,
    executionCtx
  ) => {
    executionCtx.logger.info(
      `Aggregating results for standard live quiz with ID ${liveQuizId} and block ID ${blockId}`
    )

    const quiz = await globalCtx.prisma.liveQuiz.findUnique({
      where: {
        id: liveQuizId,
        status: {
          in: [DB.PublicationStatus.PUBLISHED, DB.PublicationStatus.ENDED],
        },
      },
      include: {
        blocks: { include: { elements: true }, orderBy: { order: 'asc' } },
      },
    })
    if (!quiz) return true
    if (quiz.blocks.length === 0) return false

    const isLastBlock = quiz.blocks[quiz.blocks.length - 1]!.id === blockId
    const block = quiz.blocks.find((block) => block.id === blockId)
    if (!block) return false

    await updateLiveQuizBlockResultsFromCache({
      quizId: liveQuizId,
      blockId,
      prisma: globalCtx.prisma,
      redisExec: globalCtx.redisExec,
      redisAssessmentExec: globalCtx.redisAssessmentExec,
      updateResults: true,
      updateLeaderboards: isLastBlock,
    })

    await removeCacheEntriesBlock({
      liveQuizId,
      blockId,
      block,
      isLastBlock,
      redis: globalCtx.redisExec,
    })

    return true
  },

  handleAssessmentLiveQuizBlockClosureAggregation: async (
    { liveQuizId, blockId },
    globalCtx,
    executionCtx
  ) => {
    executionCtx.logger.info(
      `Aggregating results for assessment live quiz with ID ${liveQuizId} and block ID ${blockId}`
    )

    const quiz = await globalCtx.prisma.liveQuiz.findUnique({
      where: {
        id: liveQuizId,
        status: {
          in: [DB.PublicationStatus.PUBLISHED, DB.PublicationStatus.ENDED],
        },
      },
      include: {
        blocks: {
          include: { elements: { include: { liveQuizResponses: true } } },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!quiz) {
      executionCtx.logger.info(
        `No quiz found for ID ${liveQuizId} in status PUBLISHED or ENDED`
      )
      return true
    }

    if (quiz.blocks.length === 0) {
      executionCtx.logger.error(`Quiz with ID ${liveQuizId} has no blocks`)
      return false
    }

    const isLastBlock = quiz.blocks[quiz.blocks.length - 1]!.id === blockId
    const block = quiz.blocks.find((block) => block.id === blockId)
    if (!block) {
      executionCtx.logger.error(
        `No block found with ID ${blockId} in quiz with ID ${liveQuizId}`
      )
      return false
    }

    if (block.elements.length === 0) {
      executionCtx.logger.error(
        `Block with ID ${blockId} in quiz with ID ${liveQuizId} has no elements`
      )
      return false
    }

    if (
      block.elements.every((element) => element.liveQuizResponses.length === 0)
    ) {
      executionCtx.logger.info(
        `No responses found for any element in block with ID ${blockId} in quiz with ID ${liveQuizId}`
      )

      try {
        await removeCacheEntriesBlock({
          liveQuizId,
          blockId,
          block,
          isLastBlock,
          redis: globalCtx.redisAssessmentExec,
        })
      } catch (error) {
        executionCtx.logger.error(
          `Error removing cache entries for block with ID ${blockId} in quiz with ID ${liveQuizId}: ${error}`
        )
      }

      return true
    }

    if (isLastBlock && quiz.isGamificationEnabled) {
      executionCtx.logger.info(
        `Updating leaderboard in gamified live quiz with ID ${liveQuizId}`
      )

      await updateLiveQuizBlockResultsFromCache({
        quizId: liveQuizId,
        blockId,
        prisma: globalCtx.prisma,
        redisExec: globalCtx.redisExec,
        redisAssessmentExec: globalCtx.redisAssessmentExec,
        updateResults: false,
        updateLeaderboards: true,
      })
    }

    try {
      await globalCtx.prisma.liveQuiz.update({
        where: { id: liveQuizId },
        data: {
          blocks: {
            update: {
              where: { id: blockId },
              data: {
                elements: {
                  update: block.elements.map((instance) => ({
                    where: { id: Number(instance.id) },
                    data: {
                      anonymousResults: quiz.isAssessmentEnabled
                        ? undefined
                        : aggregateLiveQuizResponses({
                            responses: instance.liveQuizResponses,
                            elementData: instance.elementData,
                          }),
                      results: quiz.isAssessmentEnabled
                        ? aggregateLiveQuizResponses({
                            responses: instance.liveQuizResponses,
                            elementData: instance.elementData,
                          })
                        : undefined,
                    },
                  })),
                },
              },
            },
          },
        },
      })
    } catch (error) {
      executionCtx.logger.error(
        `Error updating instance results for block with ID ${blockId} in quiz with ID ${liveQuizId} based on live quiz responses: ${error}`
      )
    }

    try {
      await removeCacheEntriesBlock({
        liveQuizId,
        blockId,
        block,
        isLastBlock,
        redis: globalCtx.redisAssessmentExec,
      })
    } catch (error) {
      executionCtx.logger.error(
        `Error removing cache entries for block with ID ${blockId} in quiz with ID ${liveQuizId}: ${error}`
      )
    }

    executionCtx.logger.info(
      `Successfully conducted final results update for instances in block with ID ${blockId} in quiz with ID ${liveQuizId}`
    )

    return true
  },
}
