import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  setCourseLearningAnalyticsEnabled: vi.fn(),
}))

vi.mock('../src/services/courses.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...serviceMocks,
}))

import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'

function buildContext(permissionLevel: PermissionLevel) {
  const prismaFindUnique = vi.fn().mockImplementation(({ where }) => {
    const acceptedLevels = where.permissionLevel?.in ?? []
    return Promise.resolve(
      acceptedLevels.includes(permissionLevel) ? { permissionLevel } : null
    )
  })

  const context = {
    prisma: {
      derivedPermission: {
        findUnique: prismaFindUnique,
      },
    },
    user: {
      sub: '00000000-0000-0000-0000-000000000001',
      role: UserRole.USER,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser

  return { context, prismaFindUnique }
}

async function executeMutation(context: ContextWithUser) {
  const yoga = createYoga({
    schema,
    context: () => context,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation {
          setCourseLearningAnalyticsEnabled(
            courseId: "course-id"
            isEnabled: true
          ) {
            id
            isLearningAnalyticsEnabled
          }
        }
      `,
    }),
  })

  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string }[]
  }
}

describe('setCourseLearningAnalyticsEnabled authorization', () => {
  beforeEach(() => {
    serviceMocks.setCourseLearningAnalyticsEnabled.mockReset()
    serviceMocks.setCourseLearningAnalyticsEnabled.mockResolvedValue({
      id: 'course-id',
      isLearningAnalyticsEnabled: true,
    })
  })

  it.each([
    [PermissionLevel.ADMIN, true],
    [PermissionLevel.WRITE, false],
    [PermissionLevel.READ, false],
  ])('requires course ADMIN permission for a %s course grant', async (permissionLevel, allowed) => {
    const { context, prismaFindUnique } = buildContext(permissionLevel)

    const result = await executeMutation(context)

    expect(result.errors).toBeUndefined()
    expect(result.data?.setCourseLearningAnalyticsEnabled ?? null).toEqual(
      allowed ? { id: 'course-id', isLearningAnalyticsEnabled: true } : null
    )
    expect(
      serviceMocks.setCourseLearningAnalyticsEnabled
    ).toHaveBeenCalledTimes(allowed ? 1 : 0)
    expect(prismaFindUnique).toHaveBeenCalledWith({
      where: {
        courseId_userId: {
          courseId: 'course-id',
          userId: '00000000-0000-0000-0000-000000000001',
        },
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
  })
})
