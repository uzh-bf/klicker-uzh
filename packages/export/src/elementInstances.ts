import type { ElementType } from '@klicker-uzh/prisma/client'
import type { ElementData, ElementInstanceOptions } from '@klicker-uzh/types'

import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

export const ELEMENT_INSTANCE_HEADERS = [
  'elementInstanceId',
  'liveQuizId',
  'liveQuizName',
  'elementBlockId',
  'elementBlockOrder',
  'instanceOrder',
  'elementId',
  'elementType',
  'elementName',
  'elementContent',
  'instanceBasePointsEnabled',
  'instancePointsMultiplier',
  'isVersionOutdated',
  'optionsJson',
  'createdAt',
]

// 0-based index of the single date column above.
export const ELEMENT_INSTANCE_DATE_COLUMNS = [14]

type ElementInstanceRow = {
  id: number
  order: number
  elementId: number
  elementType: ElementType
  elementData: ElementData
  options: ElementInstanceOptions
  isVersionOutdated: boolean
  createdAt: Date
  elementBlock: {
    id: number
    order: number
    liveQuiz: { id: string; name: string; displayName: string | null }
  } | null
}

export async function fetchElementInstances(
  prisma: ReadonlyPrismaClient,
  courseId: string
): Promise<ElementInstanceRow[]> {
  return prisma.elementInstance.findMany({
    where: {
      elementBlock: {
        liveQuiz: { courseId },
      },
    },
    select: {
      id: true,
      order: true,
      elementId: true,
      elementType: true,
      elementData: true,
      options: true,
      isVersionOutdated: true,
      createdAt: true,
      elementBlock: {
        select: {
          id: true,
          order: true,
          liveQuiz: {
            select: { id: true, name: true, displayName: true },
          },
        },
      },
    },
    orderBy: [
      { elementBlock: { liveQuiz: { name: 'asc' } } },
      { elementBlock: { order: 'asc' } },
      { order: 'asc' },
    ],
  }) as Promise<ElementInstanceRow[]>
}

export function transformElementInstance(row: ElementInstanceRow): unknown[] {
  const block = row.elementBlock
  const liveQuiz = block?.liveQuiz
  const elementData = row.elementData
  const options = row.options ?? {}

  return [
    row.id,
    liveQuiz?.id ?? '',
    liveQuiz?.displayName ?? liveQuiz?.name ?? '',
    block?.id ?? '',
    block?.order ?? '',
    row.order,
    row.elementId,
    row.elementType,
    elementData.name,
    elementData.content,
    options.basePoints ?? true,
    options.pointsMultiplier ?? 1,
    row.isVersionOutdated,
    elementData.options != null ? JSON.stringify(elementData.options) : '',
    row.createdAt.toISOString(),
  ]
}
