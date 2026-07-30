import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type {
  AdaptiveCoverageReadiness,
  AdaptivePracticeQuizConfigInput as AdaptivePracticeQuizConfigInputType,
  AdaptivePracticeQuizConfigView,
  AdaptivePracticeQuizElementOverrideInput as AdaptivePracticeQuizElementOverrideInputType,
  AdaptivePracticeQuizNodeOverrideInput as AdaptivePracticeQuizNodeOverrideInputType,
  AdaptivePracticeQuizPreview,
  AdaptivePracticeQuizResearchSettingsInput as AdaptivePracticeQuizResearchSettingsInputType,
  AdaptivePracticeQuizSetupPreview,
  AdaptiveQuizReadiness,
  AdaptiveReadinessIssue,
  AdaptiveReadinessIssueParameters,
  AdaptiveRootReachability,
  PracticeQuizPublicationPreview,
} from '../services/adaptivePracticeQuizConfig.js'
import { AdaptiveLevelMappingRule, AdaptiveNodeKind } from './competenceTree.js'
import { ElementType } from './elementData.js'
import { PracticeQuizMode } from './practiceQuiz.js'

export const AdaptivePracticeQuizPreset = builder.enumType(
  'AdaptivePracticeQuizPreset',
  { values: Object.values(DB.AdaptivePracticeQuizPreset) }
)

export const AdaptiveAttemptSelectionPolicy = builder.enumType(
  'AdaptiveAttemptSelectionPolicy',
  { values: Object.values(DB.AdaptiveAttemptSelectionPolicy) }
)

export const AdaptivePracticeQuizNodeOverrideInputRef =
  builder.inputRef<AdaptivePracticeQuizNodeOverrideInputType>(
    'AdaptivePracticeQuizNodeOverrideInput'
  )
export const AdaptivePracticeQuizNodeOverrideInput =
  AdaptivePracticeQuizNodeOverrideInputRef.implement({
    fields: (t) => ({
      nodeId: t.int({ required: true }),
      enabled: t.boolean({ required: true }),
      weight: t.float({ required: false }),
      questionCap: t.int({ required: false }),
    }),
  })

export const AdaptivePracticeQuizElementOverrideInputRef =
  builder.inputRef<AdaptivePracticeQuizElementOverrideInputType>(
    'AdaptivePracticeQuizElementOverrideInput'
  )
export const AdaptivePracticeQuizElementOverrideInput =
  AdaptivePracticeQuizElementOverrideInputRef.implement({
    fields: (t) => ({
      assignmentId: t.int({ required: true }),
      enabled: t.boolean({ required: true }),
      discrimination: t.float({ required: false }),
    }),
  })

export const AdaptivePracticeQuizResearchSettingsInputRef =
  builder.inputRef<AdaptivePracticeQuizResearchSettingsInputType>(
    'AdaptivePracticeQuizResearchSettingsInput'
  )
export const AdaptivePracticeQuizResearchSettingsInput =
  AdaptivePracticeQuizResearchSettingsInputRef.implement({
    fields: (t) => ({
      levelMappingRule: t.field({
        type: AdaptiveLevelMappingRule,
        required: false,
      }),
      attemptSelectionPolicy: t.field({
        type: AdaptiveAttemptSelectionPolicy,
        required: false,
      }),
      topInformationRatio: t.float({ required: false }),
      defaultDiscrimination: t.float({ required: false }),
    }),
  })

export const AdaptivePracticeQuizConfigInputRef =
  builder.inputRef<AdaptivePracticeQuizConfigInputType>(
    'AdaptivePracticeQuizConfigInput'
  )
export const AdaptivePracticeQuizConfigInput =
  AdaptivePracticeQuizConfigInputRef.implement({
    fields: (t) => ({
      competenceTreeId: t.string({ required: true }),
      preset: t.field({ type: AdaptivePracticeQuizPreset, required: true }),
      totalQuestionCap: t.int({ required: false }),
      perLeafQuestionCap: t.int({ required: false }),
      minQuestionsPerLeaf: t.int({ required: false }),
      classificationZ: t.float({ required: false }),
      showTimer: t.boolean({ required: false }),
      nodeOverrides: t.field({
        type: [AdaptivePracticeQuizNodeOverrideInput],
        required: false,
      }),
      elementOverrides: t.field({
        type: [AdaptivePracticeQuizElementOverrideInput],
        required: false,
      }),
      researchSettings: t.field({
        type: AdaptivePracticeQuizResearchSettingsInput,
        required: false,
      }),
    }),
  })

const AdaptivePracticeQuizConfigRef =
  builder.objectRef<AdaptivePracticeQuizConfigView>(
    'AdaptivePracticeQuizConfig'
  )
export const AdaptivePracticeQuizConfig =
  AdaptivePracticeQuizConfigRef.implement({
    fields: (t) => ({
      competenceTreeId: t.exposeString('competenceTreeId'),
      preset: t.expose('preset', { type: AdaptivePracticeQuizPreset }),
      attemptSelectionPolicy: t.expose('attemptSelectionPolicy', {
        type: AdaptiveAttemptSelectionPolicy,
      }),
      totalQuestionCap: t.exposeInt('totalQuestionCap'),
      perLeafQuestionCap: t.exposeInt('perLeafQuestionCap', {
        nullable: true,
      }),
      minQuestionsPerLeaf: t.exposeInt('minQuestionsPerLeaf'),
      classificationZ: t.exposeFloat('classificationZ'),
      topInformationRatio: t.exposeFloat('topInformationRatio'),
      defaultDiscrimination: t.exposeFloat('defaultDiscrimination'),
      levelMappingRule: t.expose('levelMappingRule', {
        type: AdaptiveLevelMappingRule,
      }),
      showTimer: t.exposeBoolean('showTimer'),
    }),
  })

type AdaptivePracticeQuizLevelView =
  AdaptivePracticeQuizPreview['competenceTree']['levels'][number]

const AdaptivePracticeQuizLevelRef =
  builder.objectRef<AdaptivePracticeQuizLevelView>('AdaptivePracticeQuizLevel')
export const AdaptivePracticeQuizLevel = AdaptivePracticeQuizLevelRef.implement(
  {
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
  }
)

type AdaptivePracticeQuizTreeView =
  AdaptivePracticeQuizPreview['competenceTree']

const AdaptivePracticeQuizTreeRef =
  builder.objectRef<AdaptivePracticeQuizTreeView>('AdaptivePracticeQuizTree')
export const AdaptivePracticeQuizTree = AdaptivePracticeQuizTreeRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    maxDepth: t.exposeInt('maxDepth'),
    thetaMin: t.exposeFloat('thetaMin'),
    thetaMax: t.exposeFloat('thetaMax'),
    levels: t.expose('levels', { type: [AdaptivePracticeQuizLevelRef] }),
  }),
})

type AdaptivePracticeQuizNodeView = AdaptivePracticeQuizPreview['nodes'][number]

const AdaptivePracticeQuizNodeRef =
  builder.objectRef<AdaptivePracticeQuizNodeView>('AdaptivePracticeQuizNode')
export const AdaptivePracticeQuizNode = AdaptivePracticeQuizNodeRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    parentId: t.exposeInt('parentId', { nullable: true }),
    kind: t.expose('kind', { type: AdaptiveNodeKind }),
    name: t.exposeString('name'),
    depth: t.exposeInt('depth'),
    order: t.exposeInt('order'),
    enabled: t.exposeBoolean('enabled'),
    overrideEnabled: t.exposeBoolean('overrideEnabled'),
    effectiveEnabled: t.exposeBoolean('effectiveEnabled'),
    weight: t.exposeFloat('weight', { nullable: true }),
    questionCap: t.exposeInt('questionCap', { nullable: true }),
  }),
})

type AdaptivePracticeQuizAssignmentView =
  AdaptivePracticeQuizPreview['assignments'][number]

const AdaptivePracticeQuizAssignmentRef =
  builder.objectRef<AdaptivePracticeQuizAssignmentView>(
    'AdaptivePracticeQuizAssignment'
  )
export const AdaptivePracticeQuizAssignment =
  AdaptivePracticeQuizAssignmentRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      elementId: t.exposeInt('elementId'),
      elementName: t.exposeString('elementName'),
      elementVersion: t.exposeInt('elementVersion'),
      elementType: t.expose('elementType', { type: ElementType }),
      leafNodeId: t.exposeInt('leafNodeId'),
      levelId: t.exposeInt('levelId'),
      enabled: t.exposeBoolean('enabled'),
      sourceEnabled: t.exposeBoolean('sourceEnabled'),
      overrideEnabled: t.exposeBoolean('overrideEnabled'),
      effectiveEnabled: t.exposeBoolean('effectiveEnabled'),
      overrideDiscrimination: t.exposeFloat('overrideDiscrimination', {
        nullable: true,
      }),
      available: t.exposeBoolean('available'),
      controlledAnswerReady: t.exposeBoolean('controlledAnswerReady'),
      choiceCount: t.exposeInt('choiceCount', { nullable: true }),
      enablePercentInput: t.exposeBoolean('enablePercentInput'),
      a: t.exposeFloat('a'),
      b: t.exposeFloat('b'),
      c: t.exposeFloat('c'),
    }),
  })

const AdaptiveReadinessIssueRef = builder.objectRef<AdaptiveReadinessIssue>(
  'AdaptivePracticeQuizReadinessIssue'
)
const AdaptiveReadinessIssueParametersRef =
  builder.objectRef<AdaptiveReadinessIssueParameters>(
    'AdaptivePracticeQuizReadinessIssueParameters'
  )
export const AdaptiveReadinessIssueParametersType =
  AdaptiveReadinessIssueParametersRef.implement({
    fields: (t) => ({
      nodeName: t.exposeString('nodeName', { nullable: true }),
      elementName: t.exposeString('elementName', { nullable: true }),
      field: t.exposeString('field', { nullable: true }),
      minimumValue: t.exposeFloat('minimumValue', { nullable: true }),
      maximumValue: t.exposeFloat('maximumValue', { nullable: true }),
      targetItemCount: t.exposeInt('targetItemCount', { nullable: true }),
      enabledAssignmentCount: t.exposeInt('enabledAssignmentCount', {
        nullable: true,
      }),
      requiredQuestionCount: t.exposeInt('requiredQuestionCount', {
        nullable: true,
      }),
      availableItemCount: t.exposeInt('availableItemCount', {
        nullable: true,
      }),
      effectiveQuestionCap: t.exposeInt('effectiveQuestionCap', {
        nullable: true,
      }),
      totalQuestionCap: t.exposeInt('totalQuestionCap', { nullable: true }),
      classifiableLevelCount: t.exposeInt('classifiableLevelCount', {
        nullable: true,
      }),
      levelCount: t.exposeInt('levelCount', { nullable: true }),
      estimatedDurationMinutes: t.exposeFloat('estimatedDurationMinutes', {
        nullable: true,
      }),
      secondsPerItem: t.exposeInt('secondsPerItem', { nullable: true }),
      assignmentId: t.exposeInt('assignmentId', { nullable: true }),
      nodeId: t.exposeInt('nodeId', { nullable: true }),
    }),
  })
export const AdaptiveReadinessIssueType = AdaptiveReadinessIssueRef.implement({
  fields: (t) => ({
    code: t.exposeString('code'),
    message: t.exposeString('message'),
    parameters: t.expose('parameters', {
      type: AdaptiveReadinessIssueParametersRef,
    }),
    path: t.exposeString('path', { nullable: true }),
    nodeId: t.exposeInt('nodeId', { nullable: true }),
    leafNodeId: t.exposeInt('leafNodeId', { nullable: true }),
    levelId: t.exposeInt('levelId', { nullable: true }),
    assignmentId: t.exposeInt('assignmentId', { nullable: true }),
  }),
})

const AdaptiveCoverageReadinessRef =
  builder.objectRef<AdaptiveCoverageReadiness>(
    'AdaptivePracticeQuizCoverageReadiness'
  )
export const AdaptiveCoverageReadinessType =
  AdaptiveCoverageReadinessRef.implement({
    fields: (t) => ({
      coverageId: t.exposeInt('coverageId'),
      leafNodeId: t.exposeInt('leafNodeId'),
      levelId: t.exposeInt('levelId'),
      targetItemCount: t.exposeInt('targetItemCount'),
      enabledAssignmentCount: t.exposeInt('enabledAssignmentCount'),
      ready: t.exposeBoolean('ready'),
    }),
  })

const AdaptiveRootReachabilityRef = builder.objectRef<AdaptiveRootReachability>(
  'AdaptivePracticeQuizRootReachability'
)
export const AdaptiveRootReachabilityType =
  AdaptiveRootReachabilityRef.implement({
    fields: (t) => ({
      nodeId: t.exposeInt('nodeId'),
      availableItemCount: t.exposeInt('availableItemCount'),
      allocatedQuestionCount: t.exposeInt('allocatedQuestionCount'),
      minimumReachableStandardError: t.exposeFloat(
        'minimumReachableStandardError',
        { nullable: true }
      ),
      classifiableLevelCount: t.exposeInt('classifiableLevelCount'),
      levelCount: t.exposeInt('levelCount'),
      allLevelsPotentiallyClassifiable: t.exposeBoolean(
        'allLevelsPotentiallyClassifiable'
      ),
    }),
  })

export const AdaptiveQuizReadinessRef =
  builder.objectRef<AdaptiveQuizReadiness>('AdaptivePracticeQuizReadiness')
export const AdaptiveQuizReadinessType = AdaptiveQuizReadinessRef.implement({
  fields: (t) => ({
    ready: t.exposeBoolean('ready'),
    errors: t.expose('errors', { type: [AdaptiveReadinessIssueRef] }),
    warnings: t.expose('warnings', { type: [AdaptiveReadinessIssueRef] }),
    coverages: t.expose('coverages', {
      type: [AdaptiveCoverageReadinessRef],
    }),
    rootReachability: t.expose('rootReachability', {
      type: [AdaptiveRootReachabilityRef],
    }),
    enabledRootCount: t.exposeInt('enabledRootCount'),
    enabledLeafCount: t.exposeInt('enabledLeafCount'),
    enabledAssignmentCount: t.exposeInt('enabledAssignmentCount'),
    expectedQuestionCount: t.exposeInt('expectedQuestionCount'),
    estimatedDurationMinutes: t.exposeFloat('estimatedDurationMinutes'),
  }),
})

export const AdaptivePracticeQuizPreviewRef =
  builder.objectRef<AdaptivePracticeQuizPreview>('AdaptivePracticeQuizPreview')
export const AdaptivePracticeQuizPreviewType =
  AdaptivePracticeQuizPreviewRef.implement({
    fields: (t) => ({
      practiceQuizId: t.exposeString('practiceQuizId'),
      mode: t.expose('mode', { type: PracticeQuizMode }),
      config: t.expose('config', { type: AdaptivePracticeQuizConfigRef }),
      competenceTree: t.expose('competenceTree', {
        type: AdaptivePracticeQuizTreeRef,
      }),
      nodes: t.expose('nodes', { type: [AdaptivePracticeQuizNodeRef] }),
      assignments: t.expose('assignments', {
        type: [AdaptivePracticeQuizAssignmentRef],
      }),
      readiness: t.expose('readiness', {
        type: AdaptiveQuizReadinessRef,
      }),
      publishedPoolSize: t.exposeInt('publishedPoolSize'),
    }),
  })

export const AdaptivePracticeQuizSetupPreviewRef =
  builder.objectRef<AdaptivePracticeQuizSetupPreview>(
    'AdaptivePracticeQuizSetupPreview'
  )
export const AdaptivePracticeQuizSetupPreviewType =
  AdaptivePracticeQuizSetupPreviewRef.implement({
    fields: (t) => ({
      competenceTree: t.expose('competenceTree', {
        type: AdaptivePracticeQuizTreeRef,
      }),
      nodes: t.expose('nodes', { type: [AdaptivePracticeQuizNodeRef] }),
      assignments: t.expose('assignments', {
        type: [AdaptivePracticeQuizAssignmentRef],
      }),
      readiness: t.expose('readiness', { type: AdaptiveQuizReadinessRef }),
    }),
  })

export const PracticeQuizPublicationPreviewRef =
  builder.objectRef<PracticeQuizPublicationPreview>(
    'PracticeQuizPublicationPreview'
  )
export const PracticeQuizPublicationPreviewType =
  PracticeQuizPublicationPreviewRef.implement({
    fields: (t) => ({
      mode: t.expose('mode', { type: PracticeQuizMode }),
      canSchedule: t.exposeBoolean('canSchedule'),
      readiness: t.expose('readiness', {
        type: AdaptiveQuizReadinessRef,
        nullable: true,
      }),
      rootNodes: t.expose('rootNodes', {
        type: [AdaptivePracticeQuizNodeRef],
      }),
    }),
  })
