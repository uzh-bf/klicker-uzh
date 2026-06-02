import type * as DB from '@klicker-uzh/prisma/client'
import { createHmac } from 'node:crypto'

type ControlLiveQuizListItem = Pick<DB.LiveQuiz, 'id' | 'name' | 'status'>

type ControlLiveQuizBlockSource = Pick<
  DB.ElementBlock,
  | 'execution'
  | 'expiresAt'
  | 'id'
  | 'order'
  | 'randomSelection'
  | 'status'
  | 'timeLimit'
> & {
  elements?: Pick<DB.ElementInstance, 'elementData' | 'id'>[] | null
}

type ControlLiveQuizSource = Pick<
  DB.LiveQuiz,
  'displayName' | 'id' | 'name'
> & {
  activeBlock?: Pick<DB.ElementBlock, 'id' | 'order'> | null
  blocks?: ControlLiveQuizBlockSource[] | null
  course?: Pick<DB.Course, 'displayName' | 'id'> | null
}

type EmbeddingInfoSource = Pick<DB.LiveQuiz, 'id' | 'namespace'> & {
  blocks?:
    | {
        elements?: Pick<DB.ElementInstance, 'elementData' | 'id'>[] | null
      }[]
    | null
}

function getElementName(elementData: unknown) {
  if (!elementData || typeof elementData !== 'object') return null
  if (!('name' in elementData)) return null

  const name = (elementData as { name?: unknown }).name
  return typeof name === 'string' ? name : null
}

export function toControlLiveQuizListItem(quiz: ControlLiveQuizListItem) {
  return {
    id: quiz.id,
    name: quiz.name,
    status: quiz.status,
  }
}

export function toControlLiveQuiz(quiz: ControlLiveQuizSource | null) {
  if (!quiz) return null

  return {
    id: quiz.id,
    name: quiz.name,
    displayName: quiz.displayName,
    course: quiz.course
      ? {
          id: quiz.course.id,
          displayName: quiz.course.displayName,
        }
      : null,
    blocks:
      quiz.blocks?.map((block) => ({
        id: block.id,
        order: block.order,
        status: block.status,
        expiresAt: block.expiresAt,
        timeLimit: block.timeLimit,
        randomSelection: block.randomSelection,
        execution: block.execution,
        elements:
          block.elements?.map((instance) => ({
            id: instance.id,
            elementData: {
              name: getElementName(instance.elementData),
            },
          })) ?? [],
      })) ?? [],
    activeBlock: quiz.activeBlock
      ? {
          id: quiz.activeBlock.id,
          order: quiz.activeBlock.order,
        }
      : null,
  }
}

export function toLiveQuizEmbeddingInfo(
  quiz: EmbeddingInfoSource | null,
  secret: string
) {
  if (!quiz) return null

  const hmacEncoder = createHmac('sha256', secret)
  hmacEncoder.update(quiz.namespace + quiz.id)
  const hmac = hmacEncoder.digest('hex')

  return {
    id: quiz.id,
    hmac,
    instances:
      quiz.blocks?.flatMap(
        (block) =>
          block.elements?.map((instance) => ({
            id: instance.id,
            name: getElementName(instance.elementData) ?? '',
          })) ?? []
      ) ?? [],
  }
}
