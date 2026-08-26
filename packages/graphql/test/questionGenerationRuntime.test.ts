import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import {
  createQuestionGenerationRuntimeFromEnv,
  type FlashcardWorkflowIncompletePublicationEvent,
  type FlashcardWorkflowStartPayload,
  isElementGenerationRuntimeConfigured,
  type QuestionGenerationRuntimeDependencies,
  type QuestionWorkflowReviewEvent,
  type QuestionWorkflowStartPayload,
} from '../src/services/questionGenerationRuntime.js'

const runtimeEnvironment = {
  KB_QUESTION_GENERATION_HATCHET_CLIENT_TOKEN: 'question-tenant-token',
  KB_GENERATION_HATCHET_CLIENT_HOST_PORT: 'hatchet.example.test:7070',
  KB_GENERATION_HATCHET_CLIENT_SERVER_URL: 'https://hatchet.example.test',
  KB_GENERATION_AZURE_STORAGE_CONNECTION_STRING:
    'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test',
  KB_GRAPH_ARTIFACT_CONTAINER: 'kg-graph-artifacts',
  KB_QUESTION_INPUT_CONTAINER: 'question-inputs',
  KB_QUESTION_OUTPUT_CONTAINER: 'question-results',
  KB_QUESTION_OUTPUT_PREFIX: 'question-builds',
}

function createRuntimeHarness(
  environment: Record<string, string | undefined> = runtimeEnvironment,
  downloadedBytes = Buffer.from('artifact')
) {
  const uploadData = vi.fn(async () => ({}))
  const downloadToBuffer = vi.fn(async () => downloadedBytes)
  const download = vi.fn(async () => ({
    readableStreamBody: Readable.from([Buffer.from('artifact')]),
  }))
  const getBlockBlobClient = vi.fn(() => ({
    uploadData,
    downloadToBuffer,
    download,
  }))
  const getContainerClient = vi.fn(() => ({ getBlockBlobClient }))
  const push = vi.fn(async () => ({ eventId: 'event-1' }))
  const list = vi.fn(async () => ({
    rows: [{ taskExternalId: 'run-1' }],
  }))
  const getStatus = vi.fn(async () => 'COMPLETED')
  const createHatchetClient = vi.fn(() => ({
    events: { push },
    runs: { list, get_status: getStatus },
  }))
  const createBlobServiceClient = vi.fn(() => ({ getContainerClient }))
  const dependencies = {
    createHatchetClient,
    createBlobServiceClient,
  } satisfies QuestionGenerationRuntimeDependencies
  const runtime = createQuestionGenerationRuntimeFromEnv(
    environment,
    dependencies
  )!

  return {
    runtime,
    createHatchetClient,
    createBlobServiceClient,
    push,
    list,
    getStatus,
    getContainerClient,
    getBlockBlobClient,
    uploadData,
    downloadToBuffer,
    download,
  }
}

async function collectStream(stream: AsyncIterable<Buffer>): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function startPayload(blueprintSha256: string): QuestionWorkflowStartPayload {
  return {
    schema_version: 3,
    question_build_id: '123e4567-e89b-42d3-a456-426614174000',
    graph_version_id: 'graph-version-1',
    graph_manifest: {
      container_name: 'kg-graph-artifacts',
      blob_name: 'graph/manifest.json',
      sha256: 'c'.repeat(64),
    },
    storage_name: 'knowledge-base',
    blueprint: {
      container_name: 'question-inputs',
      blob_name: 'blueprints/input.json',
      sha256: blueprintSha256,
    },
    output: {
      container_name: 'question-results',
      blob_prefix: 'question-builds',
    },
    language: 'de',
  }
}

function flashcardStartPayload(
  blueprintSha256: string
): FlashcardWorkflowStartPayload {
  return {
    schema_version: 1,
    flashcard_build_id: '123e4567-e89b-42d3-a456-426614174001',
    graph_version_id: 'graph-version-1',
    graph_manifest: {
      container_name: 'kg-graph-artifacts',
      blob_name: 'graph/manifest.json',
      sha256: 'c'.repeat(64),
    },
    storage_name: 'knowledge-base',
    blueprint: {
      container_name: 'question-inputs',
      blob_name: 'flashcard-builds/input.json',
      sha256: blueprintSha256,
    },
    output: {
      container_name: 'question-results',
      blob_prefix: 'question-builds',
    },
    language: 'de',
  }
}

describe('question-generation runtime', () => {
  it('reports null and undefined runtimes as unavailable', () => {
    expect(isElementGenerationRuntimeConfigured(null)).toBe(false)
    expect(isElementGenerationRuntimeConfigured(undefined)).toBe(false)
    expect(
      isElementGenerationRuntimeConfigured(createRuntimeHarness().runtime)
    ).toBe(true)
  })

  it('fails closed and never falls back to the general Hatchet token', () => {
    const createHatchetClient = vi.fn()
    const runtime = createQuestionGenerationRuntimeFromEnv(
      {
        ...runtimeEnvironment,
        KB_QUESTION_GENERATION_HATCHET_CLIENT_TOKEN: undefined,
        HATCHET_CLIENT_TOKEN: 'general-klicker-token',
      },
      { createHatchetClient }
    )

    expect(runtime).toBeNull()
    expect(createHatchetClient).not.toHaveBeenCalled()
    expect(
      createQuestionGenerationRuntimeFromEnv(
        {
          ...runtimeEnvironment,
          KB_GRAPH_ARTIFACT_CONTAINER: 'graph--artifacts',
        },
        { createHatchetClient }
      )
    ).toBeNull()
    expect(
      createQuestionGenerationRuntimeFromEnv(
        {
          ...runtimeEnvironment,
          KB_QUESTION_OUTPUT_PREFIX: 'question-builds/../private',
        },
        { createHatchetClient }
      )
    ).toBeNull()
  })

  it('initializes only the dedicated Hatchet and private Blob clients', () => {
    const harness = createRuntimeHarness()

    expect(harness.createHatchetClient).toHaveBeenCalledWith({
      token: 'question-tenant-token',
      host_port: 'hatchet.example.test:7070',
      api_url: 'https://hatchet.example.test',
      log_level: 'INFO',
    })
    expect(harness.createBlobServiceClient).toHaveBeenCalledWith(
      runtimeEnvironment.KB_GENERATION_AZURE_STORAGE_CONNECTION_STRING
    )
    expect(harness.runtime).toMatchObject({
      questionInputContainer: 'question-inputs',
      questionOutputContainer: 'question-results',
      questionOutputPrefix: 'question-builds',
    })
  })

  it('uploads only matching immutable input artifacts', async () => {
    const harness = createRuntimeHarness()
    const bytes = Buffer.from('blueprint')
    const sha256 = createHash('sha256').update(bytes).digest('hex')

    await harness.runtime.uploadCreateOnly(
      {
        containerName: 'question-inputs',
        blobName: 'blueprints/input.xlsx',
        sha256,
      },
      bytes
    )

    expect(harness.getContainerClient).toHaveBeenCalledWith('question-inputs')
    expect(harness.getBlockBlobClient).toHaveBeenCalledWith(
      'blueprints/input.xlsx'
    )
    expect(harness.uploadData).toHaveBeenCalledWith(bytes, {
      conditions: { ifNoneMatch: '*' },
    })
    await expect(
      harness.runtime.uploadCreateOnly(
        {
          containerName: 'question-results',
          blobName: 'blueprints/input.xlsx',
          sha256,
        },
        bytes
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_INVALID' })
  })

  it('verifies downloaded bytes before returning them', async () => {
    const harness = createRuntimeHarness()
    const bytes = Buffer.from('artifact')
    const sha256 = createHash('sha256').update(bytes).digest('hex')

    await expect(
      harness.runtime.downloadVerified({
        containerName: 'question-results',
        blobName: 'question-builds/build/result.json',
        sha256,
      })
    ).resolves.toEqual(bytes)
    await expect(
      harness.runtime.downloadVerified({
        containerName: 'question-results',
        blobName: 'question-builds/build/result.json',
        sha256: '0'.repeat(64),
      })
    ).rejects.toMatchObject({ code: 'ARTIFACT_DIGEST_MISMATCH' })

    expect(harness.downloadToBuffer).toHaveBeenCalledWith(
      0,
      10 * 1024 * 1024 + 1
    )

    await expect(
      collectStream(
        harness.runtime.downloadVerifiedStream({
          containerName: 'question-results',
          blobName: 'question-builds/build/result.json',
          sha256,
        })
      )
    ).resolves.toEqual(bytes)
    await expect(
      collectStream(
        harness.runtime.downloadVerifiedStream({
          containerName: 'question-results',
          blobName: 'question-builds/build/result.json',
          sha256: '0'.repeat(64),
        })
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_DIGEST_MISMATCH' })
  })

  it('rejects oversized artifacts after a bounded range read', async () => {
    const harness = createRuntimeHarness(
      runtimeEnvironment,
      Buffer.alloc(10 * 1024 * 1024 + 1)
    )

    await expect(
      harness.runtime.downloadImmutable(
        'question-results',
        'question-builds/build/result.json'
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_INVALID', retryable: false })
    expect(harness.downloadToBuffer).toHaveBeenCalledWith(
      0,
      10 * 1024 * 1024 + 1
    )
  })

  it('derives immutable references only for configured output paths', async () => {
    const harness = createRuntimeHarness()
    const bytes = Buffer.from('artifact')

    await expect(
      harness.runtime.downloadImmutable(
        'question-results',
        'question-builds/build/design/resolved.json'
      )
    ).resolves.toEqual({
      ref: {
        containerName: 'question-results',
        blobName: 'question-builds/build/design/resolved.json',
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      bytes,
    })
    await expect(
      harness.runtime.downloadImmutable(
        'question-results',
        'another-prefix/build/design/resolved.json'
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_INVALID' })
  })

  it('pushes strict scoped events and resolves the workflow run', async () => {
    const harness = createRuntimeHarness()
    const blueprintSha256 = 'a'.repeat(64)
    const payload = startPayload(blueprintSha256)
    expect(Object.keys(payload).sort()).toEqual([
      'blueprint',
      'graph_manifest',
      'graph_version_id',
      'language',
      'output',
      'question_build_id',
      'schema_version',
      'storage_name',
    ])
    const scope = `question-build:${payload.question_build_id}`
    const dispatchAttemptId = '223e4567-e89b-42d3-a456-426614174000'
    const beforeProviderDispatch = vi.fn(async () => undefined)

    await expect(
      harness.runtime.start(
        payload,
        scope,
        dispatchAttemptId,
        beforeProviderDispatch
      )
    ).resolves.toEqual({ eventId: 'event-1' })
    expect(beforeProviderDispatch).toHaveBeenCalledOnce()
    expect(harness.push).toHaveBeenCalledWith(
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
    await expect(harness.runtime.getRun('event-1')).resolves.toEqual({
      runId: 'run-1',
      status: 'SUCCEEDED',
    })
    expect(harness.list).toHaveBeenCalledWith({
      triggeringEventExternalId: 'event-1',
      onlyTasks: false,
      limit: 1,
    })
    expect(harness.getStatus).toHaveBeenCalledWith('run-1')

    await expect(
      harness.runtime.findRunByBuildId(
        payload.question_build_id,
        dispatchAttemptId
      )
    ).resolves.toEqual({ runId: 'run-1', status: 'SUCCEEDED' })
    expect(harness.list).toHaveBeenLastCalledWith({
      additionalMetadata: {
        question_build_id: payload.question_build_id,
        dispatch_attempt_id: dispatchAttemptId,
        operation_kind: 'question-start',
      },
      onlyTasks: false,
      limit: 2,
    })

    const reviewAttemptId = '323e4567-e89b-42d3-a456-426614174000'
    const reviewEvent: QuestionWorkflowReviewEvent = {
      key: 'course-question-blueprint-generation:design-reviewed',
      payload: {
        schema_version: 1,
        question_build_id: payload.question_build_id,
        decision: 'approve',
        reviewed_by: 'reviewer-id',
        acknowledge_warnings: true,
        artifact: null,
      },
    }
    await expect(
      harness.runtime.review(reviewEvent, scope, reviewAttemptId)
    ).resolves.toEqual({ eventId: 'event-1' })
    expect(harness.push).toHaveBeenLastCalledWith(
      reviewEvent.key,
      reviewEvent.payload,
      {
        scope,
        additionalMetadata: {
          question_build_id: payload.question_build_id,
          dispatch_attempt_id: reviewAttemptId,
          operation_kind: 'question-review',
        },
      }
    )

    await expect(
      harness.runtime.findRunByQuestionReview(
        payload.question_build_id,
        reviewAttemptId
      )
    ).resolves.toEqual({ runId: 'run-1', status: 'SUCCEEDED' })
    expect(harness.list).toHaveBeenLastCalledWith({
      additionalMetadata: {
        question_build_id: payload.question_build_id,
        dispatch_attempt_id: reviewAttemptId,
        operation_kind: 'question-review',
      },
      onlyTasks: false,
      limit: 2,
    })
  })

  it('rejects a graph manifest stored under the configured output prefix', async () => {
    const harness = createRuntimeHarness({
      ...runtimeEnvironment,
      KB_GRAPH_ARTIFACT_CONTAINER: 'question-results',
    })
    const payload = startPayload('a'.repeat(64))
    const beforeProviderDispatch = vi.fn(async () => undefined)
    payload.graph_manifest = {
      container_name: 'question-results',
      blob_name: 'question-builds/graph/manifest.json',
      sha256: 'c'.repeat(64),
    }

    await expect(
      harness.runtime.start(
        payload,
        `question-build:${payload.question_build_id}`,
        '223e4567-e89b-42d3-a456-426614174000',
        beforeProviderDispatch
      )
    ).rejects.toMatchObject({ code: 'CONFIGURATION_INVALID' })
    expect(beforeProviderDispatch).not.toHaveBeenCalled()
    expect(harness.push).not.toHaveBeenCalled()
  })

  it('pushes separate scoped flashcard generation and publication events', async () => {
    const harness = createRuntimeHarness()
    const payload = flashcardStartPayload('a'.repeat(64))
    const scope = `flashcard-build:${payload.flashcard_build_id}`
    const startAttemptId = '223e4567-e89b-42d3-a456-426614174001'
    const publicationAttemptId = '323e4567-e89b-42d3-a456-426614174001'
    const beforeProviderDispatch = vi.fn(async () => undefined)

    await expect(
      harness.runtime.startFlashcards(
        payload,
        scope,
        startAttemptId,
        beforeProviderDispatch
      )
    ).resolves.toEqual({ eventId: 'event-1' })
    expect(beforeProviderDispatch).toHaveBeenCalledOnce()
    expect(harness.push).toHaveBeenCalledWith(
      'course-flashcard-generation:requested',
      payload,
      {
        scope,
        additionalMetadata: {
          flashcard_build_id: payload.flashcard_build_id,
          dispatch_attempt_id: startAttemptId,
          operation_kind: 'flashcard-start',
        },
      }
    )

    const publication: FlashcardWorkflowIncompletePublicationEvent = {
      schema_version: 1,
      flashcard_build_id: payload.flashcard_build_id,
      start_manifest: {
        container_name: 'question-results',
        blob_name: `question-builds/${payload.flashcard_build_id}/manifest/start.json`,
        sha256: 'd'.repeat(64),
      },
      reviewed_by: 'reviewer-id',
      acknowledge_incomplete: true,
    }
    await expect(
      harness.runtime.publishIncompleteFlashcards(
        publication,
        scope,
        publicationAttemptId
      )
    ).resolves.toEqual({ eventId: 'event-1' })
    expect(harness.push).toHaveBeenLastCalledWith(
      'course-flashcard-generation:publish-incomplete-requested',
      publication,
      {
        scope,
        additionalMetadata: {
          flashcard_build_id: payload.flashcard_build_id,
          dispatch_attempt_id: publicationAttemptId,
          operation_kind: 'flashcard-publish-incomplete',
        },
      }
    )

    await expect(
      harness.runtime.findRunByFlashcardBuildId(
        payload.flashcard_build_id,
        publicationAttemptId,
        'publish-incomplete'
      )
    ).resolves.toEqual({ runId: 'run-1', status: 'SUCCEEDED' })
    expect(harness.list).toHaveBeenLastCalledWith({
      additionalMetadata: {
        flashcard_build_id: payload.flashcard_build_id,
        dispatch_attempt_id: publicationAttemptId,
        operation_kind: 'flashcard-publish-incomplete',
      },
      onlyTasks: false,
      limit: 2,
    })
  })

  it('rejects ambiguous recovery for one exact flashcard dispatch attempt', async () => {
    const harness = createRuntimeHarness()
    harness.list.mockResolvedValueOnce({
      rows: [{ taskExternalId: 'run-1' }, { taskExternalId: 'run-2' }],
    })

    await expect(
      harness.runtime.findRunByFlashcardBuildId(
        '123e4567-e89b-42d3-a456-426614174001',
        '223e4567-e89b-42d3-a456-426614174001',
        'start'
      )
    ).rejects.toMatchObject({ code: 'WORKFLOW_DISPATCH_UNCERTAIN' })
  })
})
