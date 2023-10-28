import { LeaderboardType } from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import { pickRandom, round } from 'mathjs'
import * as R from 'ramda'
import { Context, ContextWithUser } from '../lib/context.js'
import { shuffle } from '../lib/util.js'
interface CreateParticipantGroupArgs {
  courseId: string
  name: string
}

export async function createParticipantGroup(
  { courseId, name }: CreateParticipantGroupArgs,
  ctx: ContextWithUser
) {
  const code = 100000 + Math.floor(Math.random() * 900000)

  const participantGroup = await ctx.prisma.participantGroup.create({
    data: {
      name,
      code: code,
      course: {
        connect: {
          id: courseId,
        },
      },
      participants: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  // invalidate graphql response cache
  ctx.emitter.emit('invalidate', {
    typename: 'ParticipantGroup',
    id: participantGroup.id,
  })

  return {
    ...participantGroup,
    score:
      participantGroup.averageMemberScore + participantGroup.groupActivityScore,
  }
}

interface JoinParticipantGroupArgs {
  courseId: string
  code: number
}

export async function joinParticipantGroup(
  { courseId, code }: JoinParticipantGroupArgs,
  ctx: ContextWithUser
) {
  // find participantgroup with code
  const participantGroup = await ctx.prisma.participantGroup.findUnique({
    where: {
      courseId_code: {
        courseId,
        code,
      },
    },
    include: {
      course: true,
    },
  })

  // if no participant group with the provided id exists in this course or at all, return null
  if (!participantGroup || participantGroup.course?.id !== courseId) return null

  // otherwise update the participant group with the current participant and return it
  const updatedParticipantGroup = await ctx.prisma.participantGroup.update({
    where: {
      courseId_code: {
        courseId,
        code,
      },
    },
    data: {
      participants: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  return {
    ...updatedParticipantGroup,
    score:
      updatedParticipantGroup.averageMemberScore +
      updatedParticipantGroup.groupActivityScore,
  }
}

interface LeaveParticipantGroupArgs {
  groupId: string
  courseId: string
}

export async function leaveParticipantGroup(
  { groupId, courseId }: LeaveParticipantGroupArgs,
  ctx: ContextWithUser
) {
  // find participantgroup with corresponding id
  const participantGroup = await ctx.prisma.participantGroup.findUnique({
    where: {
      id: groupId,
    },
    include: {
      participants: true,
    },
  })

  // if no participant group with the provided id exists in this course or at all, return null
  if (!participantGroup) return null

  // if the participant is the only one in the group, delete the group
  if (participantGroup.participants.length === 1) {
    await ctx.prisma.participantGroup.delete({
      where: {
        id: groupId,
      },
    })

    // invalidate graphql response cache
    ctx.emitter.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })

    return null
  }

  // otherwise update the participant group with the current participant and return it
  const updatedParticipantGroup = await ctx.prisma.participantGroup.update({
    where: {
      id: groupId,
    },
    data: {
      participants: {
        disconnect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  return {
    ...updatedParticipantGroup,
    score:
      updatedParticipantGroup.averageMemberScore +
      updatedParticipantGroup.groupActivityScore,
  }
}

interface GetParticipantGroupsArgs {
  courseId: string
}

export async function getParticipantGroups(
  { courseId }: GetParticipantGroupsArgs,
  ctx: ContextWithUser
) {
  // find participant with correspoinding id ctx.user.sub and return all his participant groups with correct id
  const participant = await ctx.prisma.participant.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      participantGroups: {
        where: {
          course: {
            id: courseId,
          },
        },
        include: {
          participants: {
            include: {
              leaderboards: {
                where: {
                  courseId,
                  type: LeaderboardType.COURSE,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!participant || !participant.participantGroups) return []

  return participant.participantGroups.map((group) => ({
    ...group,
    score: group.averageMemberScore + group.groupActivityScore,
    participants: R.sortWith(
      [R.descend(R.prop('score')), R.ascend(R.prop('username'))],
      group.participants.map((participant) => ({
        ...participant,
        score: participant.leaderboards[0]?.score ?? 0,
        isSelf: participant.id === ctx.user.sub,
      }))
    ).map((entry, ix) => ({ ...entry, rank: ix + 1 })),
  }))
}

export async function updateGroupAverageScores(ctx: Context) {
  const groupsWithParticipants = await ctx.prisma.participantGroup.findMany({
    include: {
      participants: {
        include: {
          leaderboards: {
            where: { type: LeaderboardType.COURSE },
          },
        },
      },
    },
  })

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

        // compute the average score of all participants in the group
        // if it has not changed, exit early
        // if the group consists of only one participant, the member score should be zero
        const averageMemberScore =
          aggregate.count > 1 ? round(aggregate.sum / aggregate.count, 2) : 0

        if (averageMemberScore === group.averageMemberScore)
          return Promise.resolve()

        ctx.emitter.emit('invalidate', {
          typename: 'ParticipantGroup',
          id: group.id,
        })

        return ctx.prisma.participantGroup.update({
          where: { id: group.id },
          data: { averageMemberScore },
        })
      })
    )

    // send a heartbeat to the uptime monitor
    if (typeof process.env.HEARTBEAT_DAILY_GROUP_SCORES === 'string') {
      await fetch(process.env.HEARTBEAT_DAILY_GROUP_SCORES)
    }
  } catch (e) {
    console.error(e)
  }

  return true
}

interface GetGroupActivityDetailsArgs {
  activityId: string
  groupId: string
}

export async function getGroupActivityDetails(
  { activityId, groupId }: GetGroupActivityDetailsArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id: activityId },
    include: {
      course: true,
      clues: {
        orderBy: {
          displayName: 'asc',
        },
      },
      instances: {
        orderBy: {
          order: 'asc',
        },
      },
      parameters: true,
    },
  })

  const group = await ctx.prisma.participantGroup.findUnique({
    where: { id: groupId },
    include: {
      participants: true,
    },
  })

  if (!groupActivity || !group) return null

  // ensure that the requesting participant is part of the group
  if (
    !group.participants.some((participant) => participant.id === ctx.user.sub)
  ) {
    return null
  }

  // before the active date, return null
  if (
    dayjs().isBefore(groupActivity.scheduledStartAt) ||
    dayjs().isAfter(groupActivity.scheduledEndAt)
  ) {
    return null
  }

  const activityInstance = await ctx.prisma.groupActivityInstance.findUnique({
    where: {
      groupActivityId_groupId: {
        groupActivityId: activityId,
        groupId,
      },
    },
    include: {
      clueInstanceAssignment: {
        include: {
          groupActivityClueInstance: true,
          participant: {
            select: {
              id: true,
              avatar: true,
              username: true,
            },
          },
        },
      },
    },
  })

  return {
    ...groupActivity,
    group,
    activityInstance: activityInstance
      ? {
          ...activityInstance,
          clues: activityInstance?.clueInstanceAssignment.map(
            (clueAssignment) => {
              if (clueAssignment.participantId === ctx.user.sub) {
                return {
                  ...clueAssignment.groupActivityClueInstance,
                  participant: {
                    ...clueAssignment.participant,
                    isSelf: true,
                  },
                }
              }

              return {
                ...R.dissoc('value', clueAssignment.groupActivityClueInstance),
                participant: {
                  ...clueAssignment.participant,
                  isSelf: false,
                },
              }
            }
          ),
        }
      : null,
  }
}

export async function startGroupActivity(
  { activityId, groupId }: GetGroupActivityDetailsArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id: activityId },
    include: {
      course: true,
      clues: {
        orderBy: {
          displayName: 'asc',
        },
      },
      instances: {
        orderBy: {
          order: 'asc',
        },
      },
      parameters: true,
    },
  })

  const group = await ctx.prisma.participantGroup.findUnique({
    where: { id: groupId },
    include: {
      participants: true,
    },
  })

  if (!groupActivity || !group) return null

  // ensure that the requesting participant is part of the group
  if (
    !group.participants.some((participant) => participant.id === ctx.user.sub)
  ) {
    return null
  }

  // before the active date, return null
  if (
    dayjs().isBefore(groupActivity.scheduledStartAt) ||
    dayjs().isAfter(groupActivity.scheduledEndAt)
  ) {
    return null
  }

  const groupMemberCount = group.participants.length
  if (groupMemberCount < 2) return null

  const allClues = [
    ...groupActivity.clues.map(
      R.pick(['name', 'displayName', 'type', 'unit', 'value'])
    ),
    ...groupActivity.parameters.map((parameter) => ({
      ...R.pick(['name', 'displayName', 'type', 'unit'], parameter),
      value: pickRandom(parameter.options),
    })),
  ]

  try {
    const activityInstance = await ctx.prisma.$transaction(async (prisma) => {
      const activityInstance = await prisma.groupActivityInstance.create({
        data: {
          group: {
            connect: { id: groupId },
          },
          groupActivity: {
            connect: { id: activityId },
          },
          clues: {
            create: allClues,
          },
        },
        include: {
          clues: true,
        },
      })

      const shuffledClues = shuffle(activityInstance.clues)

      const cluesPerMember = Math.ceil(
        groupActivity.clues.length / groupMemberCount
      )

      const clueAssignments = group.participants.flatMap((participant, ix) => {
        const start = ix * cluesPerMember
        const end = start + cluesPerMember
        const clues = shuffledClues.slice(start, end)

        return clues.map((clue) => ({
          groupActivityClueInstance: {
            connect: { id: clue.id },
          },
          participant: {
            connect: { id: participant.id },
          },
        }))
      })

      const updatedActivityInstance = await prisma.groupActivityInstance.update(
        {
          where: { id: activityInstance.id },
          data: {
            clueInstanceAssignment: {
              create: clueAssignments,
            },
          },
          include: {
            clueInstanceAssignment: {
              include: {
                groupActivityClueInstance: true,
                participant: true,
              },
            },
          },
        }
      )

      return updatedActivityInstance
    })

    return {
      ...groupActivity,
      group,
      activityInstance,
    }
  } catch (e) {
    console.error(e)
    return null
  }
}

interface SubmitGroupActivityDecisionsArgs {
  activityInstanceId: number
  decisions: {
    id: number
    response?: string | null
    selectedOptions?: number[] | null
  }[]
}

export async function submitGroupActivityDecisions(
  { activityInstanceId, decisions }: SubmitGroupActivityDecisionsArgs,
  ctx: ContextWithUser
) {
  const groupActivityInstance =
    await ctx.prisma.groupActivityInstance.findUnique({
      where: { id: activityInstanceId },
      include: {
        groupActivity: true,
        group: {
          include: {
            participants: {
              where: {
                id: ctx.user.sub,
              },
            },
          },
        },
      },
    })

  // if the instance does not exist or the logged-in participant is not part of the group
  // or if the results have already been submitted
  if (
    !groupActivityInstance ||
    groupActivityInstance.group.participants.length === 0 ||
    !!groupActivityInstance.decisionsSubmittedAt
  ) {
    return null
  }

  // before the active date, return null
  if (
    dayjs().isBefore(groupActivityInstance.groupActivity.scheduledStartAt) ||
    dayjs().isAfter(groupActivityInstance.groupActivity.scheduledEndAt)
  ) {
    return null
  }

  const updatedActivityInstance = await ctx.prisma.groupActivityInstance.update(
    {
      where: { id: activityInstanceId },
      data: {
        decisions,
        decisionsSubmittedAt: new Date(),
      },
    }
  )

  return updatedActivityInstance
}
