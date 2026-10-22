import type { ElementManipulationInput } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { z } from 'zod'
import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import { isAdaptiveUniqueConstraintConflict } from './adaptiveTransactions.js'
import { persistCompetenceTreeElementAssignment } from './competenceTreeCommands.js'
import type { CompetenceTreeElementAssignmentCreateInput } from './competenceTreeManagementTypes.js'
import type * as ElementHost from '@klicker-uzh/graphql/adaptive-element-host-types'

export type AdaptiveElementHost = Pick<
  typeof ElementHost,
  | 'formatManipulatedElement'
  | 'getManipulatedElementCreationIdentity'
  | 'manipulateElement'
>

export function createAdaptiveElementCommands({
  formatManipulatedElement,
  getManipulatedElementCreationIdentity,
  manipulateElement,
}: AdaptiveElementHost) {
  const creationRequestIdSchema = z.string().uuid()

  async function manipulateElementWithInitialCompetenceTreeAssignment(
    {
      elementInput,
      initialCompetenceTreeAssignment,
      initialCompetenceTreeAssignments,
      creationRequestId,
    }: {
      elementInput: ElementManipulationInput
      initialCompetenceTreeAssignment?: CompetenceTreeElementAssignmentCreateInput | null
      initialCompetenceTreeAssignments?:
        | CompetenceTreeElementAssignmentCreateInput[]
        | null
      creationRequestId?: string | null
    },
    ctx: ContextWithUser
  ) {
    if (
      initialCompetenceTreeAssignment &&
      initialCompetenceTreeAssignments != null
    ) {
      throw new GraphQLError('Provide either a single assignment or a list.', {
        extensions: { code: 'ADAPTIVE_CREATION_REQUEST_INVALID' },
      })
    }
    const assignments = [
      ...(initialCompetenceTreeAssignments ??
        (initialCompetenceTreeAssignment
          ? [initialCompetenceTreeAssignment]
          : [])),
    ].sort((a, b) => a.treeId.localeCompare(b.treeId))
    if (
      assignments.length > 100 ||
      new Set(assignments.map((item) => item.treeId)).size !==
        assignments.length
    ) {
      throw new GraphQLError('Select at most 100 distinct competence trees.', {
        extensions: { code: 'ADAPTIVE_CREATION_REQUEST_INVALID' },
      })
    }
    if (assignments.length === 0) {
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

    const elementIdentity = getManipulatedElementCreationIdentity(elementInput)
    if (!elementIdentity) return null
    const creationRequestFingerprint = fingerprintAdaptiveElementCreation({
      element: elementIdentity,
      assignment:
        assignments.length === 1
          ? assignments[0]
          : [...assignments].sort((a, b) => a.treeId.localeCompare(b.treeId)),
    })

    const existing = await findIdempotentElement(
      parsedCreationRequestId.data,
      ctx
    )
    if (existing) {
      return resolveIdempotentElement({
        existing,
        creationRequestFingerprint,
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

        await tx.element.update({
          where: { id: element.id },
          data: {
            creationRequestId: parsedCreationRequestId.data,
            creationRequestFingerprint,
          },
        })

        for (const { treeId, ...assignment } of assignments) {
          await persistCompetenceTreeElementAssignment({
            treeId,
            elementId: element.id,
            assignment,
            ownerId: ctx.user.sub,
            tx,
          })
        }
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
        creationRequestFingerprint,
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
    return await ctx.prisma.element.findUnique({
      where: { creationRequestId },
      include: {
        tags: { orderBy: { order: 'asc' } },
        answerCollectionItems: true,
      },
    })
  }

  function resolveIdempotentElement({
    existing,
    creationRequestFingerprint,
    ownerId,
  }: {
    existing: NonNullable<Awaited<ReturnType<typeof findIdempotentElement>>>
    creationRequestFingerprint: string
    ownerId: string
  }) {
    if (
      existing.ownerId !== ownerId ||
      existing.isDeleted ||
      existing.creationRequestFingerprint !== creationRequestFingerprint
    ) {
      throw new GraphQLError(
        'The adaptive creation request identifier is already in use.',
        { extensions: { code: 'ADAPTIVE_CREATION_REQUEST_CONFLICT' } }
      )
    }
    return formatManipulatedElement(existing)
  }

  function fingerprintAdaptiveElementCreation(value: unknown) {
    return createHash('sha256')
      .update(JSON.stringify(canonicalizeJson(value)))
      .digest('hex')
  }

  function canonicalizeJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalizeJson)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, canonicalizeJson(child)])
      )
    }
    return value
  }
  return { manipulateElementWithInitialCompetenceTreeAssignment }
}
