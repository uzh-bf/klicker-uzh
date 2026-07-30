import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEDICATED_LEARNING_ANALYTICS_MODELS } from '../src/lib/learningAnalyticsCleanup.js'

describe('learning analytics cleanup contract', () => {
  it('binds every dedicated result family into the reviewed contract', () => {
    expect(DEDICATED_LEARNING_ANALYTICS_MODELS).toEqual([
      'ParticipantAnalytics',
      'CompetencyAnalytics',
      'AggregatedAnalytics',
      'AggregatedCompetencyAnalytics',
      'ParticipantCourseAnalytics',
      'AggregatedCourseAnalytics',
      'ParticipantPerformance',
      'InstancePerformance',
      'ActivityPerformance',
      'ParticipantActivityPerformance',
      'ActivityProgress',
      'ParticipantChatAnalytics',
      'AggregatedChatbotAnalytics',
      'ChatTopicCluster',
      'ParticipantChatOutcome',
      'ParticipantLiveQuizAnalytics',
      'AggregatedLiveQuizAnalytics',
      'PlatformSemesterAnalytics',
    ])
  })

  it('uses the reviewed snapshot hash and a durable transactional receipt', () => {
    const source = fs.readFileSync(
      new URL(
        '../src/scripts/2026-07-30_cleanup_learning_analytics.ts',
        import.meta.url
      ),
      'utf8'
    )

    expect(source).toContain(
      'WRITE_CONFIRMATION !== currentSnapshot.snapshotHash'
    )
    expect(source).toContain('tx.learningAnalyticsCleanupReceipt.findUnique')
    expect(source).toContain('tx.learningAnalyticsCleanupReceipt.create')
    expect(source).not.toContain('DELETE_ALL_PRE_FEATURE_DERIVED_DATA')
  })
})
