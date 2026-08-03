import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type {
  CompetenceTreeAssignmentInput as CompetenceTreeAssignmentInputType,
  CompetenceTreeAssignmentView,
  CompetenceTreeCatalogOwnership as CompetenceTreeCatalogOwnershipType,
  CompetenceTreeCatalogPage,
  CompetenceTreeCourseView,
  CompetenceTreeCoverageInput as CompetenceTreeCoverageInputType,
  CompetenceTreeDetail,
  CompetenceTreeElementAssignmentCreateInput as CompetenceTreeElementAssignmentCreateInputType,
  CompetenceTreeElementAssignmentUpdateInput as CompetenceTreeElementAssignmentUpdateInputType,
  CompetenceTreeInput as CompetenceTreeInputType,
  CompetenceTreeLevelInput as CompetenceTreeLevelInputType,
  CompetenceTreeLevelView,
  CompetenceTreeMetadataInput as CompetenceTreeMetadataInputType,
  CompetenceTreeNodeInput as CompetenceTreeNodeInputType,
  CompetenceTreeSummary,
  DuplicateCompetenceTreeInput as DuplicateCompetenceTreeInputType,
} from '../services/competenceTreeManagement.js'
import type {
  CompetenceTreeValidationIssue,
  CompetenceTreeValidationResult,
  NormalizedCompetenceWeight,
} from '../services/competenceTrees.js'
import { ElementType } from './elementData.js'

export const AdaptiveLevelMappingRule = builder.enumType(
  'AdaptiveLevelMappingRule',
  { values: Object.values(DB.AdaptiveLevelMappingRule) }
)

export const AdaptiveNodeKind = builder.enumType('AdaptiveNodeKind', {
  values: Object.values(DB.AdaptiveNodeKind),
})

export const CompetenceTreeCatalogOwnership = builder.enumType(
  'CompetenceTreeCatalogOwnership',
  {
    values: [
      'OWNED',
      'LINKED',
      'ALL',
    ] as const satisfies readonly CompetenceTreeCatalogOwnershipType[],
  }
)

export const CompetenceTreeLevelInputRef =
  builder.inputRef<CompetenceTreeLevelInputType>('CompetenceTreeLevelInput')
export const CompetenceTreeLevelInput = CompetenceTreeLevelInputRef.implement({
  fields: (t) => ({
    key: t.string({ required: true }),
    label: t.string({ required: true }),
    order: t.int({ required: true }),
  }),
})

export const CompetenceTreeNodeInputRef =
  builder.inputRef<CompetenceTreeNodeInputType>('CompetenceTreeNodeInput')
export const CompetenceTreeNodeInput = CompetenceTreeNodeInputRef.implement({
  fields: (t) => ({
    key: t.string({ required: true }),
    parentKey: t.string({ required: false }),
    kind: t.field({ type: AdaptiveNodeKind, required: true }),
    name: t.string({ required: true }),
    description: t.string({ required: false }),
    order: t.int({ required: true }),
    weight: t.float({ required: false }),
  }),
})

export const CompetenceTreeCoverageInputRef =
  builder.inputRef<CompetenceTreeCoverageInputType>(
    'CompetenceTreeCoverageInput'
  )
export const CompetenceTreeCoverageInput =
  CompetenceTreeCoverageInputRef.implement({
    fields: (t) => ({
      leafKey: t.string({ required: true }),
      levelKey: t.string({ required: true }),
      targetItemCount: t.int({ required: true }),
      enabled: t.boolean({ required: true }),
    }),
  })

export const CompetenceTreeAssignmentInputRef =
  builder.inputRef<CompetenceTreeAssignmentInputType>(
    'CompetenceTreeAssignmentInput'
  )
export const CompetenceTreeAssignmentInput =
  CompetenceTreeAssignmentInputRef.implement({
    fields: (t) => ({
      elementId: t.int({ required: true }),
      leafKey: t.string({ required: true }),
      levelKey: t.string({ required: true }),
      enabled: t.boolean({ required: true }),
      discrimination: t.float({ required: false }),
      enablePercentInput: t.boolean({ required: true }),
    }),
  })

export const CompetenceTreeElementAssignmentUpdateInputRef =
  builder.inputRef<CompetenceTreeElementAssignmentUpdateInputType>(
    'CompetenceTreeElementAssignmentUpdateInput'
  )
export const CompetenceTreeElementAssignmentUpdateInput =
  CompetenceTreeElementAssignmentUpdateInputRef.implement({
    fields: (t) => ({
      leafNodeId: t.int({ required: true }),
      levelId: t.int({ required: true }),
      enabled: t.boolean({ required: true }),
      enablePercentInput: t.boolean({ required: true }),
      discrimination: t.float({ required: false }),
    }),
  })

export const CompetenceTreeElementAssignmentCreateInputRef =
  builder.inputRef<CompetenceTreeElementAssignmentCreateInputType>(
    'CompetenceTreeElementAssignmentCreateInput'
  )
export const CompetenceTreeElementAssignmentCreateInput =
  CompetenceTreeElementAssignmentCreateInputRef.implement({
    fields: (t) => ({
      treeId: t.string({ required: true }),
      leafNodeId: t.int({ required: true }),
      levelId: t.int({ required: true }),
      enabled: t.boolean({ required: true }),
      enablePercentInput: t.boolean({ required: true }),
      discrimination: t.float({ required: false }),
    }),
  })

export const CompetenceTreeInputRef = builder.inputRef<CompetenceTreeInputType>(
  'CompetenceTreeInput'
)
export const CompetenceTreeInput = CompetenceTreeInputRef.implement({
  fields: (t) => ({
    name: t.string({ required: true }),
    displayName: t.string({ required: true }),
    description: t.string({ required: false }),
    maxDepth: t.int({ required: false }),
    thetaMin: t.float({ required: false }),
    thetaMax: t.float({ required: false }),
    defaultDiscrimination: t.float({ required: false }),
    levelMappingRule: t.field({
      type: AdaptiveLevelMappingRule,
      required: false,
    }),
    levels: t.field({ type: [CompetenceTreeLevelInput], required: true }),
    nodes: t.field({ type: [CompetenceTreeNodeInput], required: true }),
    coverages: t.field({
      type: [CompetenceTreeCoverageInput],
      required: true,
    }),
    assignments: t.field({
      type: [CompetenceTreeAssignmentInput],
      required: true,
    }),
  }),
})

export const CompetenceTreeMetadataInputRef =
  builder.inputRef<CompetenceTreeMetadataInputType>(
    'CompetenceTreeMetadataInput'
  )
export const CompetenceTreeMetadataInput =
  CompetenceTreeMetadataInputRef.implement({
    fields: (t) => ({
      name: t.string({ required: true }),
      displayName: t.string({ required: true }),
      description: t.string({ required: false }),
    }),
  })

export const DuplicateCompetenceTreeInputRef =
  builder.inputRef<DuplicateCompetenceTreeInputType>(
    'DuplicateCompetenceTreeInput'
  )
export const DuplicateCompetenceTreeInput =
  DuplicateCompetenceTreeInputRef.implement({
    fields: (t) => ({
      name: t.string({ required: false }),
      displayName: t.string({ required: false }),
    }),
  })

const CompetenceTreeValidationIssueRef =
  builder.objectRef<CompetenceTreeValidationIssue>(
    'CompetenceTreeValidationIssue'
  )
export const CompetenceTreeValidationIssueType =
  CompetenceTreeValidationIssueRef.implement({
    fields: (t) => ({
      code: t.exposeString('code'),
      message: t.exposeString('message'),
      path: t.exposeString('path', { nullable: true }),
    }),
  })

const NormalizedCompetenceWeightRef =
  builder.objectRef<NormalizedCompetenceWeight>('NormalizedCompetenceWeight')
export const NormalizedCompetenceWeightType =
  NormalizedCompetenceWeightRef.implement({
    fields: (t) => ({
      nodeId: t.string({ resolve: ({ nodeId }) => String(nodeId) }),
      weight: t.exposeFloat('weight'),
    }),
  })

export const CompetenceTreeValidationResultRef =
  builder.objectRef<CompetenceTreeValidationResult>(
    'CompetenceTreeValidationResult'
  )
export const CompetenceTreeValidationResultType =
  CompetenceTreeValidationResultRef.implement({
    fields: (t) => ({
      valid: t.exposeBoolean('valid'),
      effectiveMaxDepth: t.exposeInt('effectiveMaxDepth'),
      errors: t.expose('errors', { type: [CompetenceTreeValidationIssueRef] }),
      warnings: t.expose('warnings', {
        type: [CompetenceTreeValidationIssueRef],
      }),
      normalizedRootWeights: t.expose('normalizedRootWeights', {
        type: [NormalizedCompetenceWeightRef],
      }),
    }),
  })

const CompetenceTreeCourseRef = builder.objectRef<CompetenceTreeCourseView>(
  'CompetenceTreeCourse'
)
export const CompetenceTreeCourse = CompetenceTreeCourseRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    treeId: t.exposeString('treeId'),
    courseId: t.exposeString('courseId'),
    courseName: t.string({ resolve: ({ course }) => course.name }),
    courseDisplayName: t.string({
      resolve: ({ course }) => course.displayName,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

const CompetenceTreeLevelRef = builder.objectRef<CompetenceTreeLevelView>(
  'CompetenceTreeLevel'
)
export const CompetenceTreeLevel = CompetenceTreeLevelRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    label: t.exposeString('label'),
    order: t.exposeInt('order'),
    theta: t.exposeFloat('theta'),
    lowerBound: t.float({
      nullable: true,
      resolve: ({ lowerBound }) =>
        Number.isFinite(lowerBound) ? lowerBound : null,
    }),
    upperBound: t.float({
      nullable: true,
      resolve: ({ upperBound }) =>
        Number.isFinite(upperBound) ? upperBound : null,
    }),
  }),
})

const CompetenceTreeNodeRef =
  builder.objectRef<DB.CompetenceTreeNode>('CompetenceTreeNode')
export const CompetenceTreeNode = CompetenceTreeNodeRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    kind: t.expose('kind', { type: AdaptiveNodeKind }),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    order: t.exposeInt('order'),
    depth: t.exposeInt('depth'),
    weight: t.exposeFloat('weight'),
    parentId: t.exposeInt('parentId', { nullable: true }),
  }),
})

const CompetenceTreeCoverageRef =
  builder.objectRef<DB.CompetenceTreeLeafLevelCoverage>(
    'CompetenceTreeCoverage'
  )
export const CompetenceTreeCoverage = CompetenceTreeCoverageRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    leafNodeId: t.exposeInt('leafNodeId'),
    levelId: t.exposeInt('levelId'),
    targetItemCount: t.exposeInt('targetItemCount'),
    enabled: t.exposeBoolean('enabled'),
  }),
})

const CompetenceTreeAssignmentRef =
  builder.objectRef<CompetenceTreeAssignmentView>('CompetenceTreeAssignment')
export const CompetenceTreeAssignment = CompetenceTreeAssignmentRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    elementId: t.exposeInt('elementId'),
    elementType: t.expose('elementType', { type: ElementType }),
    elementName: t.exposeString('elementName'),
    elementVersion: t.exposeInt('elementVersion'),
    leafNodeId: t.exposeInt('leafNodeId'),
    levelId: t.exposeInt('levelId'),
    enabled: t.exposeBoolean('enabled'),
    discrimination: t.exposeFloat('discrimination', { nullable: true }),
    enablePercentInput: t.exposeBoolean('enablePercentInput'),
    choiceCount: t.exposeInt('choiceCount', { nullable: true }),
    a: t.exposeFloat('a'),
    b: t.exposeFloat('b'),
    c: t.exposeFloat('c'),
  }),
})

export const CompetenceTreeSummaryRef =
  builder.objectRef<CompetenceTreeSummary>('CompetenceTreeSummary')
export const CompetenceTreeSummaryType = CompetenceTreeSummaryRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    maxDepth: t.exposeInt('maxDepth'),
    thetaMin: t.exposeFloat('thetaMin'),
    thetaMax: t.exposeFloat('thetaMax'),
    defaultDiscrimination: t.exposeFloat('defaultDiscrimination'),
    levelMappingRule: t.expose('levelMappingRule', {
      type: AdaptiveLevelMappingRule,
    }),
    levelCount: t.exposeInt('levelCount'),
    nodeCount: t.exposeInt('nodeCount'),
    assignmentCount: t.exposeInt('assignmentCount'),
    adaptiveQuizCount: t.exposeInt('adaptiveQuizCount'),
    draftAdaptiveQuizCount: t.exposeInt('draftAdaptiveQuizCount'),
    publishedAdaptiveQuizCount: t.exposeInt('publishedAdaptiveQuizCount'),
    isArchived: t.exposeBoolean('isArchived'),
    isOwner: t.exposeBoolean('isOwner'),
    canEdit: t.exposeBoolean('canEdit'),
    isStructurallyLocked: t.exposeBoolean('isStructurallyLocked'),
    courseLinks: t.expose('courseLinks', { type: [CompetenceTreeCourseRef] }),
    courseLinkCount: t.exposeInt('courseLinkCount'),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

const CompetenceTreeCatalogPageRef =
  builder.objectRef<CompetenceTreeCatalogPage>('CompetenceTreeCatalogPage')
export const CompetenceTreeCatalogPageType =
  CompetenceTreeCatalogPageRef.implement({
    fields: (t) => ({
      items: t.expose('items', { type: [CompetenceTreeSummaryRef] }),
      nextCursor: t.exposeString('nextCursor', { nullable: true }),
    }),
  })

export const CompetenceTreeRef =
  builder.objectRef<CompetenceTreeDetail>('CompetenceTree')
export const CompetenceTree = CompetenceTreeRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    maxDepth: t.exposeInt('maxDepth'),
    thetaMin: t.exposeFloat('thetaMin'),
    thetaMax: t.exposeFloat('thetaMax'),
    defaultDiscrimination: t.exposeFloat('defaultDiscrimination'),
    levelMappingRule: t.expose('levelMappingRule', {
      type: AdaptiveLevelMappingRule,
    }),
    levelCount: t.exposeInt('levelCount'),
    nodeCount: t.exposeInt('nodeCount'),
    assignmentCount: t.exposeInt('assignmentCount'),
    adaptiveQuizCount: t.exposeInt('adaptiveQuizCount'),
    draftAdaptiveQuizCount: t.exposeInt('draftAdaptiveQuizCount'),
    publishedAdaptiveQuizCount: t.exposeInt('publishedAdaptiveQuizCount'),
    isArchived: t.exposeBoolean('isArchived'),
    isOwner: t.exposeBoolean('isOwner'),
    canEdit: t.exposeBoolean('canEdit'),
    isStructurallyLocked: t.exposeBoolean('isStructurallyLocked'),
    courseLinks: t.expose('courseLinks', { type: [CompetenceTreeCourseRef] }),
    courseLinkCount: t.exposeInt('courseLinkCount'),
    levels: t.expose('levels', { type: [CompetenceTreeLevelRef] }),
    nodes: t.expose('nodes', { type: [CompetenceTreeNodeRef] }),
    levelCoverages: t.expose('levelCoverages', {
      type: [CompetenceTreeCoverageRef],
    }),
    elementAssignments: t.expose('elementAssignments', {
      type: [CompetenceTreeAssignmentRef],
    }),
    validation: t.expose('validation', {
      type: CompetenceTreeValidationResultRef,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})
