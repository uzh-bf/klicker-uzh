import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'

const serviceMocks = vi.hoisted(() => ({
  manipulatePracticeQuiz: vi.fn(),
  publishPracticeQuiz: vi.fn(),
  unpublishPracticeQuiz: vi.fn(),
  deletePracticeQuiz: vi.fn(),
  manipulateMicroLearning: vi.fn(),
  extendMicroLearning: vi.fn(),
  endMicroLearning: vi.fn(),
  publishMicroLearning: vi.fn(),
  unpublishMicroLearning: vi.fn(),
  deleteMicroLearning: vi.fn(),
  manipulateGroupActivity: vi.fn(),
  extendGroupActivity: vi.fn(),
  publishGroupActivity: vi.fn(),
  unpublishGroupActivity: vi.fn(),
  openGroupActivity: vi.fn(),
  endGroupActivity: vi.fn(),
  deleteGroupActivity: vi.fn(),
  gradeGroupActivitySubmission: vi.fn(),
  finalizeGroupActivityGrading: vi.fn(),
}))

vi.mock('../src/services/practiceQuizzes.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...serviceMocks,
}))
vi.mock('../src/services/microLearning.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...serviceMocks,
}))
vi.mock('../src/services/groups.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...serviceMocks,
}))

import '../src/schema/mutation.js'

const practiceQuizFields = [
  'createPracticeQuiz',
  'editPracticeQuiz',
  'publishPracticeQuiz',
  'unpublishPracticeQuiz',
  'deletePracticeQuiz',
] as const

const microLearningFields = [
  'createMicroLearning',
  'editMicroLearning',
  'extendMicroLearning',
  'endMicroLearning',
  'publishMicroLearning',
  'unpublishMicroLearning',
  'deleteMicroLearning',
] as const

const groupActivityFields = [
  'createGroupActivity',
  'editGroupActivity',
  'extendGroupActivity',
  'publishGroupActivity',
  'unpublishGroupActivity',
  'openGroupActivity',
  'endGroupActivity',
  'deleteGroupActivity',
  'gradeGroupActivitySubmission',
  'finalizeGroupActivityGrading',
] as const

const activityLifecycleFields = [
  ...practiceQuizFields,
  ...microLearningFields,
  ...groupActivityFields,
] as const

type LifecycleField = (typeof activityLifecycleFields)[number]

const objectPermissionFields: LifecycleField[] = activityLifecycleFields.filter(
  (field) => !field.startsWith('create')
)

const fieldToMock: Record<LifecycleField, keyof typeof serviceMocks> = {
  createPracticeQuiz: 'manipulatePracticeQuiz',
  editPracticeQuiz: 'manipulatePracticeQuiz',
  publishPracticeQuiz: 'publishPracticeQuiz',
  unpublishPracticeQuiz: 'unpublishPracticeQuiz',
  deletePracticeQuiz: 'deletePracticeQuiz',
  createMicroLearning: 'manipulateMicroLearning',
  editMicroLearning: 'manipulateMicroLearning',
  extendMicroLearning: 'extendMicroLearning',
  endMicroLearning: 'endMicroLearning',
  publishMicroLearning: 'publishMicroLearning',
  unpublishMicroLearning: 'unpublishMicroLearning',
  deleteMicroLearning: 'deleteMicroLearning',
  createGroupActivity: 'manipulateGroupActivity',
  editGroupActivity: 'manipulateGroupActivity',
  extendGroupActivity: 'extendGroupActivity',
  publishGroupActivity: 'publishGroupActivity',
  unpublishGroupActivity: 'unpublishGroupActivity',
  openGroupActivity: 'openGroupActivity',
  endGroupActivity: 'endGroupActivity',
  deleteGroupActivity: 'deleteGroupActivity',
  gradeGroupActivitySubmission: 'gradeGroupActivitySubmission',
  finalizeGroupActivityGrading: 'finalizeGroupActivityGrading',
}

const lifecycleSentinel = { sentinel: 'controlled-downstream-seam' }

const mutationArguments: Record<LifecycleField, string> = {
  createPracticeQuiz:
    'name: "S1", displayName: "S1", stacks: [], courseId: "00000000-0000-4000-8000-000000000000", multiplier: 1, order: SEQUENTIAL, resetTimeDays: 7',
  editPracticeQuiz:
    'id: "missing", name: "S1", displayName: "S1", stacks: [], courseId: "00000000-0000-4000-8000-000000000000", multiplier: 1, order: SEQUENTIAL, resetTimeDays: 7',
  publishPracticeQuiz: 'id: "missing"',
  unpublishPracticeQuiz: 'id: "missing"',
  deletePracticeQuiz: 'id: "missing"',
  createMicroLearning:
    'name: "S1", displayName: "S1", stacks: [], courseId: "00000000-0000-4000-8000-000000000000", multiplier: 1, startDate: "2026-08-23T10:00:00Z", endDate: "2026-08-24T10:00:00Z"',
  editMicroLearning:
    'id: "missing", name: "S1", displayName: "S1", stacks: [], courseId: "00000000-0000-4000-8000-000000000000", multiplier: 1, startDate: "2026-08-23T10:00:00Z", endDate: "2026-08-24T10:00:00Z"',
  extendMicroLearning: 'id: "missing", endDate: "2026-08-25T10:00:00Z"',
  endMicroLearning: 'id: "missing"',
  publishMicroLearning: 'id: "missing"',
  unpublishMicroLearning: 'id: "missing"',
  deleteMicroLearning: 'id: "missing"',
  createGroupActivity:
    'name: "S1", displayName: "S1", courseId: "00000000-0000-4000-8000-000000000000", multiplier: 1, startDate: "2026-08-23T10:00:00Z", endDate: "2026-08-24T10:00:00Z", clues: [], stack: { order: 0, elements: [] }',
  editGroupActivity:
    'id: "missing", name: "S1", displayName: "S1", courseId: "00000000-0000-4000-8000-000000000000", multiplier: 1, startDate: "2026-08-23T10:00:00Z", endDate: "2026-08-24T10:00:00Z", clues: [], stack: { order: 0, elements: [] }',
  extendGroupActivity: 'id: "missing", endDate: "2026-08-25T10:00:00Z"',
  publishGroupActivity: 'id: "missing"',
  unpublishGroupActivity: 'id: "missing"',
  openGroupActivity: 'id: "missing"',
  endGroupActivity: 'id: "missing"',
  deleteGroupActivity: 'id: "missing"',
  gradeGroupActivitySubmission:
    'id: 999999, groupActivityId: "missing", gradingDecisions: { passed: true, grading: [{ instanceId: 999999, score: 0 }] }',
  finalizeGroupActivityGrading: 'id: "missing"',
}

function buildContext({
  scope,
  catalystInstitutional = true,
  catalystIndividual = true,
}: {
  scope: UserLoginScope
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
}) {
  const prismaFindUnique = vi.fn()

  return {
    prisma: {
      derivedPermission: {
        findUnique: prismaFindUnique,
      },
    },
    user: {
      sub: '00000000-0000-4000-8000-000000000001',
      role: UserRole.USER,
      scope,
      catalystInstitutional,
      catalystIndividual,
    },
  } as ContextWithUser & {
    prisma: { derivedPermission: { findUnique: typeof prismaFindUnique } }
  }
}

async function executeMutation(
  field: LifecycleField,
  context: ContextWithUser
) {
  const source = `
    mutation {
      ${field}(${mutationArguments[field]}) {
        __typename
      }
    }
  `
  const yoga = createYoga({
    schema,
    context: () => context,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: source }),
  })
  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string }[]
  }
}

describe('Standard authorization for the activity lifecycle', () => {
  beforeEach(() => {
    for (const mock of Object.values(serviceMocks)) {
      mock.mockReset()
    }
  })

  it('contains exactly the expected standard-format mutations', () => {
    const runtimeFields = schema.getMutationType()!.getFields()
    expect(activityLifecycleFields).toHaveLength(22)
    for (const field of activityLifecycleFields) {
      expect(runtimeFields[field], field).toBeTruthy()
    }

    const unexpectedFields = Object.keys(runtimeFields).filter(
      (field) =>
        /^(create|edit|extend|publish|unpublish|open|end|delete|gradeGroupActivitySubmission|finalizeGroupActivityGrading)(PracticeQuiz|MicroLearning|GroupActivity)$/.test(
          field
        ) &&
        !activityLifecycleFields.includes(
          field as (typeof activityLifecycleFields)[number]
        )
    )
    expect(unexpectedFields).toEqual([])
  })

  it('lets a non-Catalyst full-access user reach each controlled seam', async () => {
    const context = buildContext({
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    })
    const prismaFindUnique = (
      context as ContextWithUser & {
        prisma: {
          derivedPermission: { findUnique: ReturnType<typeof vi.fn> }
        }
      }
    ).prisma.derivedPermission.findUnique
    ;(prismaFindUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      permissionLevel: 'OWNER',
    })

    for (const field of activityLifecycleFields) {
      const mock = serviceMocks[fieldToMock[field]]
      mock.mockReset()
      mock.mockResolvedValue(lifecycleSentinel)
      const result = await executeMutation(field, context)
      expect(result.errors, field).toBeUndefined()
      expect(
        (result.data?.[field] as { __typename?: string } | null)?.__typename,
        field
      ).toBeTruthy()
      expect(mock, field).toHaveBeenCalledTimes(1)
    }
  })

  it('rejects read-only access at the GraphQL boundary', async () => {
    const context = buildContext({ scope: UserLoginScope.READ_ONLY })

    for (const field of activityLifecycleFields) {
      const result = await executeMutation(field, context)
      expect(result.errors?.[0]?.message, field).toBe('Unauthorized')
      expect(serviceMocks[fieldToMock[field]], field).not.toHaveBeenCalled()
    }
  })

  it('denies an unrelated object without calling its service', async () => {
    const context = buildContext({
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    })

    for (const field of objectPermissionFields) {
      const result = await executeMutation(field, context)
      expect(result.errors, field).toBeUndefined()
      expect(result.data?.[field] ?? null, field).toBeNull()
      expect(serviceMocks[fieldToMock[field]], field).not.toHaveBeenCalled()
    }
  })
})
