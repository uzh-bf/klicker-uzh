import * as DB from '@klicker-uzh/prisma/client'
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
  KnowledgeGraphSourceReference,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import type { KBKnowledgeGraphConfig } from '../services/knowledge.js'

export const KBGraphBuildStatus = builder.enumType('KBGraphBuildStatus', {
  values: Object.values(DB.KBGraphBuildStatus),
})

export const KBGraphQualityTier = builder.enumType('KBGraphQualityTier', {
  values: Object.values(DB.KBGraphQualityTier),
})

export const KBGraphCostStatus = builder.enumType('KBGraphCostStatus', {
  values: Object.values(DB.KBGraphCostStatus),
})

export const KBKnowledgeGraphConfigRef =
  builder.objectRef<KBKnowledgeGraphConfig>('KBKnowledgeGraphConfig')
export const KBKnowledgeGraphConfigType = KBKnowledgeGraphConfigRef.implement({
  fields: (t) => ({
    kbId: t.exposeID('kbId'),
    isEnabled: t.exposeBoolean('isEnabled'),
    buildId: t.exposeID('buildId', { nullable: true }),
    status: t.expose('status', { type: KBGraphBuildStatus, nullable: true }),
    statusMessage: t.exposeString('statusMessage', { nullable: true }),
    qualityTier: t.expose('qualityTier', {
      type: KBGraphQualityTier,
      nullable: true,
    }),
    sourceContentDigest: t.exposeString('sourceContentDigest', {
      nullable: true,
    }),
    activeBuildId: t.exposeID('activeBuildId', { nullable: true }),
    publishedBuildId: t.exposeID('publishedBuildId', { nullable: true }),
    isStale: t.exposeBoolean('isStale'),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
    costConfigurationReady: t.exposeBoolean('costConfigurationReady'),
    costCurrency: t.exposeString('costCurrency', { nullable: true }),
    quotaCurrency: t.exposeString('quotaCurrency', { nullable: true }),
    billingLabel: t.exposeString('billingLabel', { nullable: true }),
    standardEstimateMinorUnits: t.exposeInt('standardEstimateMinorUnits', {
      nullable: true,
    }),
    highEstimateMinorUnits: t.exposeInt('highEstimateMinorUnits', {
      nullable: true,
    }),
    estimatedCostMinorUnits: t.exposeInt('estimatedCostMinorUnits', {
      nullable: true,
    }),
    actualCostMinorUnits: t.exposeInt('actualCostMinorUnits', {
      nullable: true,
    }),
    actualInputTokens: t.exposeInt('actualInputTokens', { nullable: true }),
    actualOutputTokens: t.exposeInt('actualOutputTokens', { nullable: true }),
    actualEmbeddingTokens: t.exposeInt('actualEmbeddingTokens', {
      nullable: true,
    }),
    actualRequestCount: t.exposeInt('actualRequestCount', {
      nullable: true,
    }),
    maxCostMinorUnits: t.exposeInt('maxCostMinorUnits', { nullable: true }),
    costStatus: t.expose('costStatus', {
      type: KBGraphCostStatus,
      nullable: true,
    }),
    semesterKey: t.exposeString('semesterKey', { nullable: true }),
    semesterQuotaMinorUnits: t.exposeInt('semesterQuotaMinorUnits', {
      nullable: true,
    }),
    semesterReservedMinorUnits: t.exposeInt('semesterReservedMinorUnits', {
      nullable: true,
    }),
    semesterSettledMinorUnits: t.exposeInt('semesterSettledMinorUnits', {
      nullable: true,
    }),
    remainingSemesterQuotaMinorUnits: t.exposeInt(
      'remainingSemesterQuotaMinorUnits',
      { nullable: true }
    ),
    worstCaseRemainingMinorUnits: t.exposeInt('worstCaseRemainingMinorUnits', {
      nullable: true,
    }),
  }),
})

export const KnowledgeGraphSourceReferenceRef =
  builder.objectRef<KnowledgeGraphSourceReference>(
    'KnowledgeGraphSourceReference'
  )
export const KnowledgeGraphSourceReferenceType =
  KnowledgeGraphSourceReferenceRef.implement({
    fields: (t) => ({
      resourceId: t.exposeID('resourceId'),
      title: t.exposeString('title'),
      reference: t.exposeString('reference', { nullable: true }),
    }),
  })

export const KnowledgeGraphNodeRef =
  builder.objectRef<KnowledgeGraphNode>('KnowledgeGraphNode')
export const KnowledgeGraphNodeType = KnowledgeGraphNodeRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    labels: t.exposeStringList('labels'),
    kind: t.exposeString('kind'),
    displayLabel: t.exposeString('displayLabel'),
    summary: t.exposeString('summary', { nullable: true }),
    content: t.exposeString('content', { nullable: true }),
    degree: t.exposeInt('degree'),
    sourceReferences: t.expose('sourceReferences', {
      type: [KnowledgeGraphSourceReferenceRef],
    }),
  }),
})

export const KnowledgeGraphEdgeRef =
  builder.objectRef<KnowledgeGraphEdge>('KnowledgeGraphEdge')
export const KnowledgeGraphEdgeType = KnowledgeGraphEdgeRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    source: t.exposeID('source'),
    target: t.exposeID('target'),
    type: t.exposeString('type'),
    label: t.exposeString('label'),
    properties: t.expose('properties', { type: 'Json' }),
  }),
})

export const KnowledgeGraphResponseRef =
  builder.objectRef<KnowledgeGraphResponse>('KnowledgeGraphResponse')
export const KnowledgeGraphResponseType = KnowledgeGraphResponseRef.implement({
  fields: (t) => ({
    kbId: t.exposeID('kbId'),
    buildId: t.exposeID('buildId'),
    isStale: t.exposeBoolean('isStale'),
    nodes: t.expose('nodes', { type: [KnowledgeGraphNodeRef] }),
    edges: t.expose('edges', { type: [KnowledgeGraphEdgeRef] }),
    truncated: t.exposeBoolean('truncated'),
  }),
})
