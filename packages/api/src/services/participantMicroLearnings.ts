import {
  PublicationStatus,
  UserRole,
  type Course,
  type ElementInstance,
  type ElementStack,
  type MicroLearning,
  type Participation,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  toElementDataWithoutSolutions,
  type PracticeQuizElementDataWithoutSolutions,
} from './participantPracticeQuizzes.js'

type MicroLearningUser =
  | {
      role?: UserRole | null
      sub: string
    }
  | null
  | undefined

type MicroLearningElementSource = Pick<
  ElementInstance,
  'elementData' | 'elementType' | 'id' | 'type'
>

type MicroLearningStackSource = Pick<
  ElementStack,
  'description' | 'displayName' | 'id' | 'order' | 'type'
> & {
  elements?: MicroLearningElementSource[] | null
}

type MicroLearningSource = Pick<
  MicroLearning,
  | 'description'
  | 'displayName'
  | 'id'
  | 'name'
  | 'ownerId'
  | 'pointsMultiplier'
  | 'scheduledEndAt'
  | 'scheduledStartAt'
  | 'status'
> & {
  course: Pick<Course, 'color' | 'displayName' | 'id'>
  stacks?: MicroLearningStackSource[] | null
}

export type MicroLearningDetail = Omit<
  MicroLearningSource,
  'course' | 'ownerId' | 'scheduledEndAt' | 'scheduledStartAt' | 'stacks'
> & {
  __typename: 'MicroLearning'
  course: Pick<Course, 'color' | 'displayName' | 'id'> & {
    __typename: 'Course'
  }
  isOwner: boolean
  scheduledEndAt: string
  scheduledStartAt: string
  stacks: (Pick<
    ElementStack,
    'description' | 'displayName' | 'id' | 'order' | 'type'
  > & {
    __typename: 'ElementStack'
    elements: (Pick<ElementInstance, 'elementType' | 'id' | 'type'> & {
      __typename: 'ElementInstance'
      elementData: PracticeQuizElementDataWithoutSolutions
    })[]
  })[]
}

export type MicroLearningDetailOutput = {
  microLearning: MicroLearningDetail | null
}

export type ParticipantCourseParticipationOutput = {
  participation: Pick<Participation, 'id' | 'isActive'> | null
}

export type MarkMicroLearningCompletedOutput = {
  participation: {
    completedMicroLearnings: string[]
    id: number
  }
}

function toMicroLearningStack(stack: MicroLearningStackSource) {
  return {
    __typename: 'ElementStack' as const,
    id: stack.id,
    type: stack.type,
    displayName: stack.displayName,
    description: stack.description,
    order: stack.order,
    elements:
      stack.elements?.map((element) => ({
        __typename: 'ElementInstance' as const,
        id: element.id,
        type: element.type,
        elementType: element.elementType,
        elementData: toElementDataWithoutSolutions(element.elementData),
      })) ?? [],
  }
}

function toMicroLearningDetail({
  isOwner,
  microLearning,
}: {
  isOwner: boolean
  microLearning: MicroLearningSource
}): MicroLearningDetail {
  return {
    __typename: 'MicroLearning',
    id: microLearning.id,
    status: microLearning.status,
    name: microLearning.name,
    displayName: microLearning.displayName,
    description: microLearning.description,
    pointsMultiplier: microLearning.pointsMultiplier,
    scheduledStartAt: microLearning.scheduledStartAt.toISOString(),
    scheduledEndAt: microLearning.scheduledEndAt.toISOString(),
    isOwner,
    course: {
      __typename: 'Course',
      id: microLearning.course.id,
      displayName: microLearning.course.displayName,
      color: microLearning.course.color,
    },
    stacks: microLearning.stacks?.map(toMicroLearningStack) ?? [],
  }
}

export async function getMicroLearningDetail({
  id,
  prisma,
  user,
}: {
  id: string
  prisma: PrismaClient
  user?: MicroLearningUser
}): Promise<MicroLearningDetailOutput> {
  const userId = user?.sub

  const microLearning = await prisma.microLearning.findUnique({
    where: {
      id,
      OR: [
        { status: PublicationStatus.PUBLISHED, isDeleted: false },
        ...(userId ? [{ permissions: { some: { userId } } }] : []),
      ],
    },
    select: {
      id: true,
      status: true,
      name: true,
      displayName: true,
      description: true,
      pointsMultiplier: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      ownerId: true,
      course: {
        select: {
          id: true,
          displayName: true,
          color: true,
        },
      },
      stacks: {
        orderBy: {
          order: 'asc',
        },
        select: {
          id: true,
          type: true,
          displayName: true,
          description: true,
          order: true,
          elements: {
            orderBy: {
              order: 'asc',
            },
            select: {
              id: true,
              type: true,
              elementType: true,
              elementData: true,
            },
          },
        },
      },
    },
  })

  if (!microLearning) return { microLearning: null }

  const isOwner =
    user?.sub &&
    (user.role === UserRole.USER || user.role === UserRole.ADMIN) &&
    user.sub === microLearning.ownerId
      ? true
      : false

  return {
    microLearning: toMicroLearningDetail({
      isOwner,
      microLearning,
    }),
  }
}

export async function getParticipantCourseParticipation({
  courseId,
  prisma,
  user,
}: {
  courseId: string
  prisma: PrismaClient
  user?: MicroLearningUser
}): Promise<ParticipantCourseParticipationOutput> {
  if (!user?.sub || user.role !== UserRole.PARTICIPANT) {
    return { participation: null }
  }

  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: user.sub,
      },
    },
    select: {
      id: true,
      isActive: true,
    },
  })

  return { participation }
}

export async function markMicroLearningCompleted({
  courseId,
  id,
  participantId,
  prisma,
}: {
  courseId: string
  id: string
  participantId: string
  prisma: PrismaClient
}): Promise<MarkMicroLearningCompletedOutput> {
  const participation = await prisma.participation.update({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
    data: {
      completedMicroLearnings: {
        push: id,
      },
    },
    select: {
      id: true,
      completedMicroLearnings: true,
    },
  })

  return { participation }
}
