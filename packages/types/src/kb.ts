export type KBJsonScalar = string | number | boolean | null

export type KBJsonValue =
  | KBJsonScalar
  | KBJsonValue[]
  | { [key: string]: KBJsonValue }

export type KBStudyLevel = 'BACHELOR' | 'MASTER' | 'BOTH' | 'PHD' | 'OTHER'

export type KBScope =
  | 'UZH_WIDE'
  | 'FACULTY'
  | 'DEPARTMENT'
  | 'COURSE'
  | 'CUSTOM'

export type KBAudience =
  | 'LECTURERS'
  | 'STUDENTS'
  | 'TUTORS'
  | 'ADMINISTRATORS'
  | 'PUBLIC'

export type KBRetrievalStrategy = 'HYBRID' | 'VECTOR' | 'BM25'

export type KBCitationMode = 'REQUIRED' | 'OPTIONAL' | 'DISABLED'

export type KBOffScopeFallback = 'REFUSE' | 'REFUSE_AND_SUGGEST' | 'ALLOW'

export interface KBMetadata {
  studyLevel?: KBStudyLevel | null
  scope?: KBScope | null
  faculty?: string | null
  department?: string | null
  courseId?: string | null
  courseIds?: string[]
  language?: string | null
  audience?: KBAudience[]
  tags?: string[]
  visibility?: string[]
  retrievalTags?: string[]
  custom?: Record<string, KBJsonValue>
}

export interface KBResourceMetadata {
  studyLevel?: KBStudyLevel | null
  scope?: KBScope | null
  faculty?: string | null
  department?: string | null
  courseId?: string | null
  language?: string | null
  audience?: KBAudience[]
  visibleToStudents?: boolean
  retrievalTags?: string[]
  accessLevel?: string | null
  sourceOwner?: string | null
  custom?: Record<string, KBJsonValue>
}

export interface KBSettings {
  generationModelId?: string | null
  embeddingModelId?: string | null
  rerankingModelId?: string | null
  retrieval?: {
    chunksPerQuery?: number | null
    similarityThreshold?: number | null
    contextWindowTokens?: number | null
    strategy?: KBRetrievalStrategy | null
    citationMode?: KBCitationMode | null
    offScopeFallback?: KBOffScopeFallback | null
  }
  budget?: {
    monthlyLimitCents?: number | null
    alertThresholdPercent?: number | null
  }
  external?: {
    ingestionPipelineId?: string | null
    vectorNamespace?: string | null
    graphNamespace?: string | null
    parserProfile?: string | null
  }
}

export interface KBIngestionStats {
  resourcesDiscovered?: number | null
  resourcesCreated?: number | null
  resourcesUpdated?: number | null
  pagesDiscovered?: number | null
  pagesScraped?: number | null
  chunksCreated?: number | null
  chunksDeleted?: number | null
  entitiesExtracted?: number | null
  bytesProcessed?: number | null
  durationMs?: number | null
  warnings?: string[]
  external?: Record<string, KBJsonValue>
}

export interface KBWebhookPayload {
  eventId?: string
  eventType?: string
  occurredAt?: string
  kb?: Record<string, unknown>
  resource?: Record<string, unknown>
  ingestionRun?: Record<string, unknown>
  graph?: Record<string, unknown>
  stats?: KBIngestionStats
  error?: Record<string, unknown>
  subresources?: Array<Record<string, unknown>>
  external?: Record<string, unknown>
}
