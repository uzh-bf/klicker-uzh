import { createHash } from 'node:crypto'
import { BlobServiceClient } from '@azure/storage-blob'
import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import type { QuestionGenerationArtifactRef } from '@klicker-uzh/types'
import {
  QuestionGenerationServiceError,
  questionGenerationServiceError,
} from './questionGenerationErrors.js'

const SHA256_PATTERN = /^[0-9a-f]{64}$/
const CONTAINER_PATTERN = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/
const MAX_QUESTION_OUTPUT_PREFIX_LENGTH = 901
const MAX_BUFFERED_ARTIFACT_BYTES = 10 * 1024 * 1024

export type QuestionWorkflowStartPayload = {
  schema_version: 3
  question_build_id: string
  graph_version_id: string
  graph_manifest: {
    container_name: string
    blob_name: string
    sha256: string
  }
  storage_name: string
  blueprint: {
    container_name: string
    blob_name: string
    sha256: string
  }
  output: {
    container_name: string
    blob_prefix: string
  }
  language: 'de' | 'en'
}

export type QuestionWorkflowReviewEvent = {
  key:
    | 'course-question-blueprint-generation:design-reviewed'
    | 'course-question-blueprint-generation:plan-reviewed'
  payload: {
    schema_version: 1
    question_build_id: string
    decision: 'approve' | 'reject'
    reviewed_by: string
    acknowledge_warnings: boolean
    artifact: null
  }
}

export type FlashcardWorkflowStartPayload = {
  schema_version: 1
  flashcard_build_id: string
  graph_version_id: string
  graph_manifest: QuestionWorkflowStartPayload['graph_manifest']
  storage_name: string
  blueprint: QuestionWorkflowStartPayload['blueprint']
  output: QuestionWorkflowStartPayload['output']
  language: 'de' | 'en'
}

export type FlashcardWorkflowIncompletePublicationEvent = {
  schema_version: 1
  flashcard_build_id: string
  start_manifest: QuestionWorkflowStartPayload['graph_manifest']
  reviewed_by: string
  acknowledge_incomplete: true
}

export type QuestionGenerationRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

export interface QuestionGenerationRuntime {
  readonly questionInputContainer: string
  readonly questionOutputContainer: string
  readonly questionOutputPrefix: string
  uploadCreateOnly(
    ref: QuestionGenerationArtifactRef,
    bytes: Buffer
  ): Promise<void>
  downloadImmutable(
    containerName: string,
    blobName: string
  ): Promise<{ ref: QuestionGenerationArtifactRef; bytes: Buffer }>
  downloadVerified(ref: QuestionGenerationArtifactRef): Promise<Buffer>
  downloadVerifiedStream(
    ref: QuestionGenerationArtifactRef
  ): AsyncIterable<Buffer>
  start(
    payload: QuestionWorkflowStartPayload,
    scope: string,
    dispatchAttemptId: string,
    beforeProviderDispatch: () => Promise<void>
  ): Promise<{ eventId: string }>
  review(
    event: QuestionWorkflowReviewEvent,
    scope: string,
    dispatchAttemptId: string
  ): Promise<{ eventId: string }>
  getRun(eventId: string): Promise<{
    runId: string | null
    status: QuestionGenerationRunStatus
  }>
  getRunById(runId: string): Promise<{
    runId: string
    status: QuestionGenerationRunStatus
  }>
  findRunByBuildId(
    buildId: string,
    dispatchAttemptId: string
  ): Promise<{
    runId: string
    status: QuestionGenerationRunStatus
  } | null>
  findRunByQuestionReview(
    buildId: string,
    dispatchAttemptId: string
  ): Promise<{
    runId: string
    status: QuestionGenerationRunStatus
  } | null>
}

export interface FlashcardGenerationRuntime extends QuestionGenerationRuntime {
  startFlashcards(
    payload: FlashcardWorkflowStartPayload,
    scope: string,
    dispatchAttemptId: string,
    beforeProviderDispatch: () => Promise<void>
  ): Promise<{ eventId: string }>
  publishIncompleteFlashcards(
    event: FlashcardWorkflowIncompletePublicationEvent,
    scope: string,
    dispatchAttemptId: string
  ): Promise<{ eventId: string }>
  findRunByFlashcardBuildId(
    buildId: string,
    dispatchAttemptId: string,
    operation: 'start' | 'publish-incomplete'
  ): Promise<{
    runId: string
    status: QuestionGenerationRunStatus
  } | null>
}

export function isElementGenerationRuntimeConfigured(
  runtime: QuestionGenerationRuntime | null | undefined
): runtime is QuestionGenerationRuntime {
  return runtime != null
}

type RuntimeEnvironment = Record<string, string | undefined>
type RuntimeHatchetClient = {
  events: {
    push(
      key: string,
      input: unknown,
      options?: {
        additionalMetadata?: Record<string, string>
        scope?: string
      }
    ): Promise<{ eventId: string }>
  }
  runs: {
    list(options: {
      triggeringEventExternalId?: string
      additionalMetadata?: Record<string, string>
      onlyTasks: boolean
      limit: number
    }): Promise<{ rows: Array<{ taskExternalId: string }> }>
    get_status(runId: string): Promise<string>
  }
}
type RuntimeBlobServiceClient = {
  getContainerClient(containerName: string): {
    getBlockBlobClient(blobName: string): {
      uploadData(
        bytes: Buffer,
        options: { conditions: { ifNoneMatch: string } }
      ): Promise<unknown>
      downloadToBuffer(offset?: number, count?: number): Promise<Buffer>
      download(): Promise<{
        readableStreamBody?: AsyncIterable<Uint8Array>
      }>
    }
  }
}

export type QuestionGenerationRuntimeDependencies = {
  createHatchetClient?: (
    config: Parameters<typeof HatchetClient.init>[0]
  ) => RuntimeHatchetClient
  createBlobServiceClient?: (
    connectionString: string
  ) => RuntimeBlobServiceClient
}

type QuestionGenerationRuntimeConfiguration = {
  hatchetToken: string
  hatchetHostPort: string
  hatchetServerUrl: string
  storageConnectionString: string
  graphArtifactContainer: string
  questionInputContainer: string
  questionOutputContainer: string
  questionOutputPrefix: string
}

function requiredEnvironmentValue(
  env: RuntimeEnvironment,
  name: string
): string | null {
  const value = env[name]?.trim()
  return value ? value : null
}

function isCanonicalBlobPath(value: string, maxLength = 1024) {
  const pathSegments = value.split('/')
  return (
    value.length <= maxLength &&
    value.trim() === value &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.includes('?') &&
    !value.includes('#') &&
    !Array.from(value).some((character) => character.charCodeAt(0) <= 31) &&
    pathSegments.every(
      (segment) => segment && segment !== '.' && segment !== '..'
    )
  )
}

function readRuntimeConfiguration(
  env: RuntimeEnvironment
): QuestionGenerationRuntimeConfiguration | null {
  const hatchetToken = requiredEnvironmentValue(
    env,
    'KB_QUESTION_GENERATION_HATCHET_CLIENT_TOKEN'
  )
  const hatchetHostPort = requiredEnvironmentValue(
    env,
    'KB_GENERATION_HATCHET_CLIENT_HOST_PORT'
  )
  const hatchetServerUrl = requiredEnvironmentValue(
    env,
    'KB_GENERATION_HATCHET_CLIENT_SERVER_URL'
  )
  const storageConnectionString = requiredEnvironmentValue(
    env,
    'KB_GENERATION_AZURE_STORAGE_CONNECTION_STRING'
  )
  const graphArtifactContainer = requiredEnvironmentValue(
    env,
    'KB_GRAPH_ARTIFACT_CONTAINER'
  )
  const questionInputContainer = requiredEnvironmentValue(
    env,
    'KB_QUESTION_INPUT_CONTAINER'
  )
  const questionOutputContainer = requiredEnvironmentValue(
    env,
    'KB_QUESTION_OUTPUT_CONTAINER'
  )
  const questionOutputPrefix = requiredEnvironmentValue(
    env,
    'KB_QUESTION_OUTPUT_PREFIX'
  )

  if (
    !hatchetToken ||
    !hatchetHostPort ||
    !hatchetServerUrl ||
    !storageConnectionString ||
    !graphArtifactContainer ||
    !questionInputContainer ||
    !questionOutputContainer ||
    !questionOutputPrefix
  ) {
    return null
  }
  if (
    !CONTAINER_PATTERN.test(graphArtifactContainer) ||
    !CONTAINER_PATTERN.test(questionInputContainer) ||
    !CONTAINER_PATTERN.test(questionOutputContainer) ||
    !isCanonicalBlobPath(
      questionOutputPrefix,
      MAX_QUESTION_OUTPUT_PREFIX_LENGTH
    )
  ) {
    return null
  }

  return {
    hatchetToken,
    hatchetHostPort,
    hatchetServerUrl,
    storageConnectionString,
    graphArtifactContainer,
    questionInputContainer,
    questionOutputContainer,
    questionOutputPrefix,
  }
}

function assertArtifactReference(
  ref: QuestionGenerationArtifactRef,
  allowedContainers: ReadonlySet<string>
) {
  assertArtifactCoordinate(ref.containerName, ref.blobName, allowedContainers)
  if (!SHA256_PATTERN.test(ref.sha256)) {
    throw questionGenerationServiceError(
      'ARTIFACT_INVALID',
      'Question-generation artifact reference is invalid'
    )
  }
}

function assertArtifactCoordinate(
  containerName: string,
  blobName: string,
  allowedContainers: ReadonlySet<string>
) {
  if (!allowedContainers.has(containerName) || !isCanonicalBlobPath(blobName)) {
    throw questionGenerationServiceError(
      'ARTIFACT_INVALID',
      'Question-generation artifact reference is invalid'
    )
  }
}

function mapRunStatus(status: string): QuestionGenerationRunStatus {
  switch (status) {
    case 'QUEUED':
      return 'PENDING'
    case 'RUNNING':
      return 'RUNNING'
    case 'COMPLETED':
      return 'SUCCEEDED'
    case 'FAILED':
      return 'FAILED'
    case 'CANCELLED':
      return 'CANCELLED'
    default:
      throw questionGenerationServiceError(
        'WORKFLOW_STATUS_UNAVAILABLE',
        'Question-generation workflow returned an unsupported status',
        true
      )
  }
}

class ProductionQuestionGenerationRuntime
  implements FlashcardGenerationRuntime
{
  private readonly readableContainers: ReadonlySet<string>
  readonly questionInputContainer: string
  readonly questionOutputContainer: string
  readonly questionOutputPrefix: string

  constructor(
    private readonly hatchet: RuntimeHatchetClient,
    private readonly blobService: RuntimeBlobServiceClient,
    private readonly configuration: QuestionGenerationRuntimeConfiguration
  ) {
    this.questionInputContainer = configuration.questionInputContainer
    this.questionOutputContainer = configuration.questionOutputContainer
    this.questionOutputPrefix = configuration.questionOutputPrefix
    this.readableContainers = new Set([
      configuration.graphArtifactContainer,
      configuration.questionInputContainer,
      configuration.questionOutputContainer,
    ])
  }

  async uploadCreateOnly(
    ref: QuestionGenerationArtifactRef,
    bytes: Buffer
  ): Promise<void> {
    assertArtifactReference(
      ref,
      new Set([this.configuration.questionInputContainer])
    )
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== ref.sha256) {
      throw questionGenerationServiceError(
        'ARTIFACT_DIGEST_MISMATCH',
        'Question-generation artifact digest does not match its content'
      )
    }

    try {
      await this.blobService
        .getContainerClient(ref.containerName)
        .getBlockBlobClient(ref.blobName)
        .uploadData(bytes, { conditions: { ifNoneMatch: '*' } })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 409
      ) {
        throw questionGenerationServiceError(
          'ARTIFACT_UPLOAD_CONFLICT',
          'Question-generation artifact already exists'
        )
      }
      throw questionGenerationServiceError(
        'QUESTION_GENERATION_UNAVAILABLE',
        'Question-generation artifact storage is unavailable',
        true
      )
    }
  }

  async downloadVerified(ref: QuestionGenerationArtifactRef): Promise<Buffer> {
    assertArtifactReference(ref, this.readableContainers)
    const bytes = await this.downloadBytes(ref.containerName, ref.blobName)

    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== ref.sha256) {
      throw questionGenerationServiceError(
        'ARTIFACT_DIGEST_MISMATCH',
        'Question-generation artifact digest verification failed'
      )
    }
    return bytes
  }

  async *downloadVerifiedStream(
    ref: QuestionGenerationArtifactRef
  ): AsyncIterable<Buffer> {
    assertArtifactReference(ref, this.readableContainers)
    let stream: AsyncIterable<Uint8Array>
    try {
      const response = await this.blobService
        .getContainerClient(ref.containerName)
        .getBlockBlobClient(ref.blobName)
        .download()
      if (!response.readableStreamBody) {
        throw new Error('Blob download did not provide a readable stream')
      }
      stream = response.readableStreamBody
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 404
      ) {
        throw questionGenerationServiceError(
          'ARTIFACT_NOT_FOUND',
          'Question-generation artifact is not available yet',
          true
        )
      }
      throw questionGenerationServiceError(
        'QUESTION_GENERATION_UNAVAILABLE',
        'Question-generation artifact storage is unavailable',
        true
      )
    }

    const digest = createHash('sha256')
    try {
      for await (const chunk of stream) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        digest.update(bytes)
        yield bytes
      }
    } catch (error) {
      if (error instanceof QuestionGenerationServiceError) throw error
      throw questionGenerationServiceError(
        'QUESTION_GENERATION_UNAVAILABLE',
        'Question-generation artifact storage is unavailable',
        true
      )
    }
    if (digest.digest('hex') !== ref.sha256) {
      throw questionGenerationServiceError(
        'ARTIFACT_DIGEST_MISMATCH',
        'Question-generation artifact digest verification failed'
      )
    }
  }

  async downloadImmutable(
    containerName: string,
    blobName: string
  ): Promise<{ ref: QuestionGenerationArtifactRef; bytes: Buffer }> {
    assertArtifactCoordinate(
      containerName,
      blobName,
      new Set([this.configuration.questionOutputContainer])
    )
    if (!blobName.startsWith(`${this.configuration.questionOutputPrefix}/`)) {
      throw questionGenerationServiceError(
        'ARTIFACT_INVALID',
        'Question-generation output path is invalid'
      )
    }

    const bytes = await this.downloadBytes(containerName, blobName)
    return {
      ref: {
        containerName,
        blobName,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      bytes,
    }
  }

  private async downloadBytes(
    containerName: string,
    blobName: string
  ): Promise<Buffer> {
    let bytes: Buffer
    try {
      bytes = await this.blobService
        .getContainerClient(containerName)
        .getBlockBlobClient(blobName)
        .downloadToBuffer(0, MAX_BUFFERED_ARTIFACT_BYTES + 1)
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 404
      ) {
        throw questionGenerationServiceError(
          'ARTIFACT_NOT_FOUND',
          'Question-generation artifact is not available yet',
          true
        )
      }
      throw questionGenerationServiceError(
        'QUESTION_GENERATION_UNAVAILABLE',
        'Question-generation artifact storage is unavailable',
        true
      )
    }
    if (bytes.byteLength > MAX_BUFFERED_ARTIFACT_BYTES) {
      throw questionGenerationServiceError(
        'ARTIFACT_INVALID',
        'Question-generation artifact exceeds the size limit'
      )
    }
    return bytes
  }

  async start(
    payload: QuestionWorkflowStartPayload,
    scope: string,
    dispatchAttemptId: string,
    beforeProviderDispatch: () => Promise<void>
  ): Promise<{ eventId: string }> {
    assertArtifactReference(
      {
        containerName: payload.blueprint.container_name,
        blobName: payload.blueprint.blob_name,
        sha256: payload.blueprint.sha256,
      },
      new Set([this.configuration.questionInputContainer])
    )
    assertArtifactReference(
      {
        containerName: payload.graph_manifest.container_name,
        blobName: payload.graph_manifest.blob_name,
        sha256: payload.graph_manifest.sha256,
      },
      new Set([this.configuration.graphArtifactContainer])
    )
    if (
      payload.schema_version !== 3 ||
      !dispatchAttemptId.trim() ||
      !payload.graph_version_id ||
      !payload.graph_manifest.blob_name.endsWith('/manifest.json') ||
      scope !== `question-build:${payload.question_build_id}` ||
      payload.output.container_name !==
        this.configuration.questionOutputContainer ||
      payload.output.blob_prefix !== this.configuration.questionOutputPrefix ||
      (payload.graph_manifest.container_name ===
        payload.output.container_name &&
        (payload.graph_manifest.blob_name === payload.output.blob_prefix ||
          payload.graph_manifest.blob_name.startsWith(
            `${payload.output.blob_prefix}/`
          )))
    ) {
      throw questionGenerationServiceError(
        'CONFIGURATION_INVALID',
        'Question-generation workflow coordinates are invalid'
      )
    }

    await beforeProviderDispatch()
    try {
      const event = await this.hatchet.events.push(
        'course-question-blueprint-generation:requested',
        payload,
        {
          scope,
          additionalMetadata: {
            question_build_id: payload.question_build_id,
            dispatch_attempt_id: dispatchAttemptId,
            operation_kind: 'question-start',
          },
        }
      )
      return { eventId: event.eventId }
    } catch {
      throw questionGenerationServiceError(
        'WORKFLOW_DISPATCH_UNCERTAIN',
        'Question-generation workflow dispatch could not be confirmed',
        true
      )
    }
  }

  async review(
    event: QuestionWorkflowReviewEvent,
    scope: string,
    dispatchAttemptId: string
  ): Promise<{ eventId: string }> {
    if (
      !dispatchAttemptId.trim() ||
      scope !== `question-build:${event.payload.question_build_id}`
    ) {
      throw questionGenerationServiceError(
        'CONFIGURATION_INVALID',
        'Question-generation review scope is invalid'
      )
    }

    try {
      const pushed = await this.hatchet.events.push(event.key, event.payload, {
        scope,
        additionalMetadata: {
          question_build_id: event.payload.question_build_id,
          dispatch_attempt_id: dispatchAttemptId,
          operation_kind: 'question-review',
        },
      })
      return { eventId: pushed.eventId }
    } catch {
      throw questionGenerationServiceError(
        'WORKFLOW_DISPATCH_UNCERTAIN',
        'Question-generation review dispatch could not be confirmed',
        true
      )
    }
  }

  async startFlashcards(
    payload: FlashcardWorkflowStartPayload,
    scope: string,
    dispatchAttemptId: string,
    beforeProviderDispatch: () => Promise<void>
  ): Promise<{ eventId: string }> {
    assertArtifactReference(
      {
        containerName: payload.blueprint.container_name,
        blobName: payload.blueprint.blob_name,
        sha256: payload.blueprint.sha256,
      },
      new Set([this.configuration.questionInputContainer])
    )
    assertArtifactReference(
      {
        containerName: payload.graph_manifest.container_name,
        blobName: payload.graph_manifest.blob_name,
        sha256: payload.graph_manifest.sha256,
      },
      new Set([this.configuration.graphArtifactContainer])
    )
    if (
      payload.schema_version !== 1 ||
      !dispatchAttemptId.trim() ||
      !payload.graph_version_id ||
      !payload.graph_manifest.blob_name.endsWith('/manifest.json') ||
      scope !== `flashcard-build:${payload.flashcard_build_id}` ||
      payload.output.container_name !==
        this.configuration.questionOutputContainer ||
      payload.output.blob_prefix !== this.configuration.questionOutputPrefix ||
      (payload.graph_manifest.container_name ===
        payload.output.container_name &&
        (payload.graph_manifest.blob_name === payload.output.blob_prefix ||
          payload.graph_manifest.blob_name.startsWith(
            `${payload.output.blob_prefix}/`
          )))
    ) {
      throw questionGenerationServiceError(
        'CONFIGURATION_INVALID',
        'Flashcard-generation workflow coordinates are invalid'
      )
    }

    await beforeProviderDispatch()
    try {
      const event = await this.hatchet.events.push(
        'course-flashcard-generation:requested',
        payload,
        {
          scope,
          additionalMetadata: {
            flashcard_build_id: payload.flashcard_build_id,
            dispatch_attempt_id: dispatchAttemptId,
            operation_kind: 'flashcard-start',
          },
        }
      )
      return { eventId: event.eventId }
    } catch {
      throw questionGenerationServiceError(
        'WORKFLOW_DISPATCH_UNCERTAIN',
        'Flashcard-generation workflow dispatch could not be confirmed',
        true
      )
    }
  }

  async publishIncompleteFlashcards(
    event: FlashcardWorkflowIncompletePublicationEvent,
    scope: string,
    dispatchAttemptId: string
  ): Promise<{ eventId: string }> {
    assertArtifactReference(
      {
        containerName: event.start_manifest.container_name,
        blobName: event.start_manifest.blob_name,
        sha256: event.start_manifest.sha256,
      },
      new Set([this.configuration.questionOutputContainer])
    )
    const expectedPath = `${this.configuration.questionOutputPrefix}/${event.flashcard_build_id}/manifest/start.json`
    if (
      event.schema_version !== 1 ||
      !dispatchAttemptId.trim() ||
      !event.reviewed_by.trim() ||
      event.acknowledge_incomplete !== true ||
      event.start_manifest.blob_name !== expectedPath ||
      scope !== `flashcard-build:${event.flashcard_build_id}`
    ) {
      throw questionGenerationServiceError(
        'CONFIGURATION_INVALID',
        'Incomplete flashcard publication coordinates are invalid'
      )
    }

    try {
      const pushed = await this.hatchet.events.push(
        'course-flashcard-generation:publish-incomplete-requested',
        event,
        {
          scope,
          additionalMetadata: {
            flashcard_build_id: event.flashcard_build_id,
            dispatch_attempt_id: dispatchAttemptId,
            operation_kind: 'flashcard-publish-incomplete',
          },
        }
      )
      return { eventId: pushed.eventId }
    } catch {
      throw questionGenerationServiceError(
        'WORKFLOW_DISPATCH_UNCERTAIN',
        'Incomplete flashcard publication dispatch could not be confirmed',
        true
      )
    }
  }

  async getRun(eventId: string): Promise<{
    runId: string | null
    status: QuestionGenerationRunStatus
  }> {
    try {
      const runs = await this.hatchet.runs.list({
        triggeringEventExternalId: eventId,
        onlyTasks: false,
        limit: 1,
      })
      const run = runs.rows[0]
      if (!run) return { runId: null, status: 'PENDING' }
      return this.getRunById(run.taskExternalId)
    } catch (error) {
      if (error instanceof QuestionGenerationServiceError) {
        throw error
      }
      throw questionGenerationServiceError(
        'WORKFLOW_STATUS_UNAVAILABLE',
        'Question-generation workflow status is unavailable',
        true
      )
    }
  }

  async getRunById(runId: string): Promise<{
    runId: string
    status: QuestionGenerationRunStatus
  }> {
    try {
      const status = await this.hatchet.runs.get_status(runId)
      return { runId, status: mapRunStatus(status) }
    } catch (error) {
      if (error instanceof QuestionGenerationServiceError) {
        throw error
      }
      throw questionGenerationServiceError(
        'WORKFLOW_STATUS_UNAVAILABLE',
        'Question-generation workflow status is unavailable',
        true
      )
    }
  }

  async findRunByBuildId(
    buildId: string,
    dispatchAttemptId: string
  ): Promise<{
    runId: string
    status: QuestionGenerationRunStatus
  } | null> {
    try {
      const runs = await this.hatchet.runs.list({
        additionalMetadata: {
          question_build_id: buildId,
          dispatch_attempt_id: dispatchAttemptId,
          operation_kind: 'question-start',
        },
        onlyTasks: false,
        limit: 2,
      })
      if (runs.rows.length > 1) {
        throw questionGenerationServiceError(
          'WORKFLOW_DISPATCH_UNCERTAIN',
          'Multiple workflow runs exist for the question build',
          true
        )
      }
      const run = runs.rows[0]
      return run ? this.getRunById(run.taskExternalId) : null
    } catch (error) {
      if (error instanceof QuestionGenerationServiceError) {
        throw error
      }
      throw questionGenerationServiceError(
        'WORKFLOW_STATUS_UNAVAILABLE',
        'Question-generation workflow recovery is unavailable',
        true
      )
    }
  }

  async findRunByQuestionReview(
    buildId: string,
    dispatchAttemptId: string
  ): Promise<{
    runId: string
    status: QuestionGenerationRunStatus
  } | null> {
    try {
      const runs = await this.hatchet.runs.list({
        additionalMetadata: {
          question_build_id: buildId,
          dispatch_attempt_id: dispatchAttemptId,
          operation_kind: 'question-review',
        },
        onlyTasks: false,
        limit: 2,
      })
      if (runs.rows.length > 1) {
        throw questionGenerationServiceError(
          'WORKFLOW_DISPATCH_UNCERTAIN',
          'Multiple workflow runs exist for the question review attempt',
          true
        )
      }
      const run = runs.rows[0]
      return run ? this.getRunById(run.taskExternalId) : null
    } catch (error) {
      if (error instanceof QuestionGenerationServiceError) {
        throw error
      }
      throw questionGenerationServiceError(
        'WORKFLOW_STATUS_UNAVAILABLE',
        'Question-generation review recovery is unavailable',
        true
      )
    }
  }

  async findRunByFlashcardBuildId(
    buildId: string,
    dispatchAttemptId: string,
    operation: 'start' | 'publish-incomplete'
  ): Promise<{
    runId: string
    status: QuestionGenerationRunStatus
  } | null> {
    try {
      const runs = await this.hatchet.runs.list({
        additionalMetadata: {
          flashcard_build_id: buildId,
          dispatch_attempt_id: dispatchAttemptId,
          operation_kind:
            operation === 'start'
              ? 'flashcard-start'
              : 'flashcard-publish-incomplete',
        },
        onlyTasks: false,
        limit: 2,
      })
      if (runs.rows.length > 1) {
        throw questionGenerationServiceError(
          'WORKFLOW_DISPATCH_UNCERTAIN',
          'Multiple workflow runs exist for the flashcard dispatch attempt',
          true
        )
      }
      const run = runs.rows[0]
      return run ? this.getRunById(run.taskExternalId) : null
    } catch (error) {
      if (error instanceof QuestionGenerationServiceError) {
        throw error
      }
      throw questionGenerationServiceError(
        'WORKFLOW_STATUS_UNAVAILABLE',
        'Flashcard-generation workflow recovery is unavailable',
        true
      )
    }
  }
}

export function createQuestionGenerationRuntimeFromEnv(
  env: RuntimeEnvironment,
  dependencies: QuestionGenerationRuntimeDependencies = {}
): FlashcardGenerationRuntime | null {
  const configuration = readRuntimeConfiguration(env)
  if (!configuration) return null

  const createHatchetClient =
    dependencies.createHatchetClient ??
    ((config) => HatchetClient.init(config) as RuntimeHatchetClient)
  const createBlobServiceClient =
    dependencies.createBlobServiceClient ??
    ((connectionString) =>
      BlobServiceClient.fromConnectionString(
        connectionString
      ) as RuntimeBlobServiceClient)

  const hatchet = createHatchetClient({
    token: configuration.hatchetToken,
    host_port: configuration.hatchetHostPort,
    api_url: configuration.hatchetServerUrl,
    log_level: 'INFO',
  })
  const blobService = createBlobServiceClient(
    configuration.storageConnectionString
  )

  return new ProductionQuestionGenerationRuntime(
    hatchet,
    blobService,
    configuration
  )
}
