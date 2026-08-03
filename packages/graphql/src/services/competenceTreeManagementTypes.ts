import * as DB from '@klicker-uzh/prisma/client'
import type { CompetenceTreeValidationResult } from './competenceTreeValidationTypes.js'

export type CompetenceTreeCourseView = DB.CompetenceTreeCourse & {
  course: Pick<DB.Course, 'id' | 'name' | 'displayName'>
}

export type CompetenceTreeSummary = DB.CompetenceTree & {
  courseLinks: CompetenceTreeCourseView[]
  courseLinkCount: number
  levelCount: number
  nodeCount: number
  assignmentCount: number
  adaptiveQuizCount: number
  draftAdaptiveQuizCount: number
  publishedAdaptiveQuizCount: number
  isArchived: boolean
  isOwner: boolean
  canEdit: boolean
  isStructurallyLocked: boolean
}

export type CompetenceTreeCatalogOwnership = 'OWNED' | 'LINKED' | 'ALL'

export type CompetenceTreeCatalogPage = {
  items: CompetenceTreeSummary[]
  nextCursor: string | null
}

export type CompetenceTreeCatalogArgs = {
  search?: string | null
  cursor?: string | null
  limit?: number | null
  includeArchived?: boolean | null
  ownership?: CompetenceTreeCatalogOwnership | null
  courseId?: string | null
  excludeCourseId?: string | null
}

export type CompetenceTreeElementAssignmentUpdateInput = {
  leafNodeId: number
  levelId: number
  enabled: boolean
  enablePercentInput: boolean
  discrimination?: number | null
}

export type CompetenceTreeElementAssignmentCreateInput =
  CompetenceTreeElementAssignmentUpdateInput & {
    treeId: string
  }

export type CompetenceTreeLevelView = DB.CompetenceTreeLevel & {
  theta: number
  lowerBound: number
  upperBound: number
}

export type CompetenceTreeAssignmentView =
  DB.CompetenceTreeElementAssignment & {
    elementType: DB.ElementType
    elementName: string
    elementVersion: number
    choiceCount: number | null
    a: number
    b: number
    c: number
  }

export type CompetenceTreeDetail = CompetenceTreeSummary & {
  levels: CompetenceTreeLevelView[]
  nodes: DB.CompetenceTreeNode[]
  levelCoverages: DB.CompetenceTreeLeafLevelCoverage[]
  elementAssignments: CompetenceTreeAssignmentView[]
  validation: CompetenceTreeValidationResult
}
