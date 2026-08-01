import type { ElementManipulationInput } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import { EventEmitter } from 'node:events'
import { z } from 'zod'
import type { ContextWithUser } from '../lib/context.js'
import { isAdaptiveUniqueConstraintConflict } from './adaptiveTransactions.js'
import { persistCompetenceTreeElementAssignment } from './competenceTreeCommands.js'
import type { CompetenceTreeElementAssignmentCreateInput } from './competenceTreeManagementTypes.js'
import {
  formatManipulatedElement,
  manipulateElement,
  matchesManipulatedElementCreationInput,
} from './elements.js'

const creationRequestIdSchema = z.string().uuid()

export async function manipulateElementWithInitialCompetenceTreeAssignment(
  {
    elementInput,
    initialCompetenceTreeAssignment,
    creationRequestId,
  }: {
    elementInput: ElementManipulationInput
    initialCompetenceTreeAssignment?: CompetenceTreeElementAssignmentCreateInput | null
    creationRequestId?: string | null
  },
  ctx: ContextWithUser
) {
  if (!initialCompetenceTreeAssignment) {
    if (creationRequestId) {
      throw new GraphQLError(
        'An adaptive creation request requires an initial competence-tree assignment.',
        { extensions: { code: 'ADAPTIVE_CREATION_REQUEST_INVALID' } }
      )
    }
    return await manipulateElement(elementInput, ctx)
  }
  if (typeof elementInput.id === 'number') {
    throw new GraphQLError(
      'An initial competence-tree assignment is only valid while creating an element.',
      { extensions: { code: 'ADAPTIVE_INITIAL_ASSIGNMENT_CREATE_ONLY' } }
    )
  }

  const parsedCreationRequestId =
    creationRequestIdSchema.safeParse(creationRequestId)
  if (!parsedCreationRequestId.success) {
    throw new GraphQLError(
      'Adaptive first-save element creation requires a valid request identifier.',
      { extensions: { code: 'ADAPTIVE_CREATION_REQUEST_INVALID' } }
    )
  }

  const existing = await findIdempotentElement(
    parsedCreationRequestId.data,
    ctx
  )
  if (existing) {
    return resolveIdempotentElement({
      existing,
      elementInput,
      initialCompetenceTreeAssignment,
      ownerId: ctx.user.sub,
    })
  }

  const bufferedEmitter = new EventEmitter()
  let createdElement
  try {
    createdElement = await ctx.prisma.$transaction(async (tx) => {
      const element = await manipulateElement(elementInput, {
        ...ctx,
        prisma: tx,
        emitter: bufferedEmitter,
      })
      if (!element) return null

      const { treeId, ...assignment } = initialCompetenceTreeAssignment
      await persistCompetenceTreeElementAssignment({
        treeId,
        elementId: element.id,
        assignment,
        creationRequestId: parsedCreationRequestId.data,
        ownerId: ctx.user.sub,
        tx,
      })
      return element
    })
  } catch (error) {
    if (!isAdaptiveUniqueConstraintConflict(error)) throw error
    const concurrent = await findIdempotentElement(
      parsedCreationRequestId.data,
      ctx
    )
    if (!concurrent) throw error
    return resolveIdempotentElement({
      existing: concurrent,
      elementInput,
      initialCompetenceTreeAssignment,
      ownerId: ctx.user.sub,
    })
  }

  if (createdElement) {
    ctx.emitter.emit('invalidate', {
      typename: 'Element',
      id: createdElement.id,
    })
  }
  return createdElement
}

async function findIdempotentElement(
  creationRequestId: string,
  ctx: ContextWithUser
) {
  return await ctx.prisma.competenceTreeElementAssignment.findUnique({
    where: { creationRequestId },
    include: {
      element: {
        include: {
          tags: { orderBy: { order: 'asc' } },
          answerCollectionItems: true,
        },
      },
    },
  })
}

function resolveIdempotentElement({
  existing,
  elementInput,
  initialCompetenceTreeAssignment,
  ownerId,
}: {
  existing: NonNullable<Awaited<ReturnType<typeof findIdempotentElement>>>
  elementInput: ElementManipulationInput
  initialCompetenceTreeAssignment: CompetenceTreeElementAssignmentCreateInput
  ownerId: string
}) {
  if (
    existing.element.ownerId !== ownerId ||
    existing.treeId !== initialCompetenceTreeAssignment.treeId ||
    existing.leafNodeId !== initialCompetenceTreeAssignment.leafNodeId ||
    existing.levelId !== initialCompetenceTreeAssignment.levelId ||
    existing.enabled !== initialCompetenceTreeAssignment.enabled ||
    existing.enablePercentInput !==
      initialCompetenceTreeAssignment.enablePercentInput ||
    existing.discrimination !==
      (initialCompetenceTreeAssignment.discrimination ?? null) ||
    !matchesManipulatedElementCreationInput(elementInput, existing.element)
  ) {
    throw new GraphQLError(
      'The adaptive creation request identifier is already in use.',
      { extensions: { code: 'ADAPTIVE_CREATION_REQUEST_CONFLICT' } }
    )
  }
  return formatManipulatedElement(existing.element)
}
