import {
  createAdaptiveClient,
  MAX_POSTERIOR_BATCH_RESPONSES,
  MAX_POSTERIOR_BATCH_SUBJECTS,
  MAX_POSTERIOR_RESPONSES_PER_SUBJECT,
  type PosteriorBatchRequest,
  type PosteriorBatchResponse,
} from '@klicker-uzh/adaptive-client'
import type {
  AdaptiveScaleDefinition,
  AdaptiveScoredResponse,
} from '@klicker-uzh/adaptive-contract'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'

/** Only request-local indexes and scored numerical metadata leave Klicker. */
export async function estimateAdaptivePosteriorBatches({
  scale,
  subjects,
  credibleMass,
}: {
  scale: AdaptiveScaleDefinition
  subjects: readonly { responses: AdaptiveScoredResponse[] }[]
  credibleMass: number
}) {
  const baseUrl = process.env.ADAPTIVE_ENGINE_URL
  const token = process.env.ADAPTIVE_ENGINE_TOKEN
  if (!baseUrl || !token) {
    throw adaptivePracticeQuizError(
      'The adaptive calculation service is not configured.',
      'ADAPTIVE_ENGINE_UNAVAILABLE'
    )
  }
  if (scale.classificationPolicyVersion !== 1)
    throw new Error('ADAPTIVE_CLASSIFICATION_POLICY_UNSUPPORTED')
  const client = createAdaptiveClient({ baseUrl, token })
  const results: PosteriorBatchResponse['subjects'] = []
  let batch: PosteriorBatchRequest['subjects'] = []
  let responseCount = 0
  const flush = async () => {
    if (batch.length === 0) return
    const result = await client.posteriors({
      contractVersion: 1,
      measurementVersion: 'IRT_V2_EAP_GRID_1',
      credibleMass,
      scale: {
        ...scale,
        classificationPolicyVersion: 1,
        levels: scale.levels.map((level) => ({
          ...level,
          label: `level-${level.order}`,
          lowerBound: Number.isFinite(level.lowerBound)
            ? level.lowerBound
            : null,
          upperBound: Number.isFinite(level.upperBound)
            ? level.upperBound
            : null,
        })),
      },
      subjects: batch,
    })
    results.push(...result.subjects)
    batch = []
    responseCount = 0
  }
  for (const [localId, subject] of subjects.entries()) {
    if (subject.responses.length > MAX_POSTERIOR_RESPONSES_PER_SUBJECT)
      throw new Error('ADAPTIVE_VALIDATION_RESPONSE_LIMIT')
    if (
      batch.length >= MAX_POSTERIOR_BATCH_SUBJECTS ||
      responseCount + subject.responses.length > MAX_POSTERIOR_BATCH_RESPONSES
    )
      await flush()
    batch.push({
      localId,
      responses: subject.responses.map(({ item, correct }) => ({
        correct,
        item: {
          id: item.id,
          itemType: item.itemType,
          choiceCount: item.choiceCount,
          model: item.model,
          calibrationId: item.calibrationId,
          a: item.discrimination,
          b: item.difficulty,
          c: item.guessing,
        },
      })),
    })
    responseCount += subject.responses.length
  }
  await flush()
  return new Map(results.map((result) => [result.localId, result]))
}
