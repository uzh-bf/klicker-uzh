import {
  DiscussionScopeType,
  DiscussionSpaceType,
  PermissionLevel,
} from '@klicker-uzh/prisma/client'
import { getPrisma } from '../global-setup.js'

export const COURSE_QA_DATA = {
  course: 'Testkurs',
  threads: {
    course1: 'This is the first course-level QA question from a student.',
    course2: 'A second question about the course material.',
    reply1: 'Here is a helpful reply to the first thread.',
    stack1:
      'This question is specifically about the first stack of the practice quiz.',
  },
  embed: {
    externalSource: 'lms-moodle',
    externalRef: 'week-01-block-a',
    anonymousThread:
      'This is an anonymous question posted from an embedded context.',
    anonymousReply:
      'This is an anonymous reply posted from an embedded context.',
    identifiedThread:
      'This is an identified question posted from an embedded context.',
  },
} as const

export type CourseQAFlags = {
  isCourseQARolloutEnabled?: boolean
  isCourseQAEnabled?: boolean
  isCourseQAAnonymousEnabled?: boolean
  isGamificationEnabled?: boolean
  isAssessmentEnabled?: boolean
  description?: string | null
}

export async function setCourseQAFlags(
  courseName: string,
  flags: CourseQAFlags
) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName },
    select: { id: true },
  })

  if (!course) {
    throw new Error(`Course not found: ${courseName}`)
  }

  await prisma.course.update({
    where: { id: course.id },
    data: flags,
  })
}

export async function getCourseOverviewSettings(courseName: string) {
  const prisma = await getPrisma()
  const settings = await prisma.course.findFirst({
    where: { name: courseName },
    select: {
      isGamificationEnabled: true,
      isAssessmentEnabled: true,
      description: true,
    },
  })

  if (!settings) {
    throw new Error(`Course not found: ${courseName}`)
  }

  return settings
}

export async function grantCourseReadAccess(
  courseName: string,
  userEmail: string
) {
  const prisma = await getPrisma()
  const [course, user] = await Promise.all([
    prisma.course.findFirst({
      where: { name: courseName },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    }),
  ])

  if (!course || !user) {
    throw new Error(`Course or user not found: ${courseName}, ${userEmail}`)
  }

  await prisma.derivedPermission.upsert({
    where: {
      courseId_userId: {
        courseId: course.id,
        userId: user.id,
      },
    },
    create: {
      courseId: course.id,
      userId: user.id,
      permissionLevel: PermissionLevel.READ,
    },
    update: {
      permissionLevel: PermissionLevel.READ,
    },
  })
}

export async function seedCourseDiscussionThreads({
  courseName,
  contents,
  replaceExisting = false,
}: {
  courseName: string
  contents: string[]
  replaceExisting?: boolean
}) {
  const prisma = await getPrisma()
  const course = await prisma.course.findFirst({
    where: { name: courseName },
    select: { id: true },
  })

  if (!course) {
    throw new Error(`Course not found: ${courseName}`)
  }

  const space = await prisma.discussionSpace.upsert({
    where: { courseId: course.id },
    create: {
      courseId: course.id,
      spaceType: DiscussionSpaceType.COURSE,
    },
    update: {},
  })
  const scope = await prisma.discussionScope.upsert({
    where: {
      spaceId_scopeKey: {
        spaceId: space.id,
        scopeKey: `course:${course.id}`,
      },
    },
    create: {
      spaceId: space.id,
      scopeType: DiscussionScopeType.COURSE,
      scopeKey: `course:${course.id}`,
      scopeLabel: 'Course',
    },
    update: {},
  })

  if (replaceExisting) {
    await prisma.discussionThread.deleteMany({
      where: {
        scope: {
          spaceId: space.id,
        },
      },
    })
  }

  const createdAt = Date.now()
  await prisma.discussionThread.createMany({
    data: contents.map((content, index) => ({
      scopeId: scope.id,
      content,
      createdAt: new Date(createdAt - (contents.length - index) * 1000),
      lastActivityAt: new Date(createdAt - (contents.length - index) * 1000),
    })),
  })
}
