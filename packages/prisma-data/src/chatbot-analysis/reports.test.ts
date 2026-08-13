import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import type {
  AnalysisCoreResult,
  AnalysisRecordProvider,
  EligibilityDecision,
} from './core.js'
import {
  assertLegacyMessageContentExportDisabled,
  buildAggregateReport,
  buildDisclosureTable,
  type ReportMessage,
  runAggregateReport,
} from './reports.js'

const window = {
  from: new Date('2026-08-01T00:00:00.000Z'),
  to: new Date('2026-08-01T23:59:59.999Z'),
}

function message(
  id: string,
  overrides: Partial<ReportMessage> = {}
): ReportMessage {
  return {
    id,
    threadId: `thread-${id}`,
    participantId: `participant-${id}`,
    chatbotId: 'chatbot-1',
    courseId: 'course-1',
    parentId: null,
    role: 'user',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    rating: null,
    text: `synthetic ${id}`,
    attachmentCount: 0,
    creditsUsed: 1,
    ...overrides,
  }
}

function eligible(
  participantId: string,
  courseId = 'course-1'
): EligibilityDecision {
  return {
    participantId,
    purpose: 'learning-analytics',
    courseId,
    effectiveFrom: window.from,
    effectiveTo: window.to,
    eligible: true,
  }
}

function core(messages: ReportMessage[]): AnalysisCoreResult {
  const assistant = messages.find((message) => message.role === 'assistant')
  const user = messages.find((message) => message.role === 'user')
  return {
    eligible: { messages, excludedMessageIds: [] },
    exchanges: user
      ? [
          {
            userMessage: user,
            assistantMessage: assistant ?? null,
            status: assistant ? 'linked' : 'absent',
            candidateAssistantIds: assistant ? [assistant.id] : [],
          },
        ]
      : [],
    ratingCoverage: {
      ratedResponses: assistant?.rating ? 1 : 0,
      unratedResponses: assistant?.rating ? 0 : assistant ? 1 : 0,
      up: assistant?.rating === 'UP' ? 1 : 0,
      down: assistant?.rating === 'DOWN' ? 1 : 0,
      coverage: assistant?.rating ? 1 : 0,
    },
  }
}

describe('governed chatbot reports', () => {
  it('suppresses small one-dimensional cells and omits the total', () => {
    const table = buildDisclosureTable(
      'mode',
      new Map([
        ['auto', 5],
        ['manual', 2],
      ])
    )

    expect(table).toEqual({
      dimension: 'mode',
      minimumCellSize: 5,
      suppressed: true,
      rows: [
        { label: 'auto', value: 5 },
        { label: 'manual', value: null },
      ],
      total: null,
    })
  })

  it('builds an aggregate report without content or stable identifiers', () => {
    const user = message('user', {
      participantId: 'participant-1',
      threadId: 'thread-1',
      chatMode: 'tutor',
      attachmentCount: 1,
    })
    const assistant = message('assistant', {
      participantId: 'participant-1',
      threadId: 'thread-1',
      role: 'assistant',
      parentId: 'user',
      modelId: 'auto',
      rating: 'UP',
    })
    const report = buildAggregateReport({
      core: core([user, assistant]),
      messages: [user, assistant],
      purpose: 'learning-analytics',
      window,
    })

    expect(report.reportKind).toBe('aggregate')
    expect(report.privacy.containsMessageContent).toBe(false)
    expect(report.privacy.containsStableIdentifiers).toBe(false)
    expect(report.summary).toMatchObject({
      eligibleMessages: null,
      userMessages: null,
      assistantMessages: null,
      participants: null,
      conversations: null,
      attachments: null,
      creditsInternalUnits: null,
    })
    expect(JSON.stringify(report)).not.toContain('synthetic user')
    expect(JSON.stringify(report)).not.toContain('participant-1')
  })

  it('suppresses a scalar total when a same-population dimension has a hidden cell', () => {
    const users = Array.from({ length: 6 }, (_, index) =>
      message(`user-${index}`, {
        threadId: 'thread-1',
        participantId: `participant-${index}`,
        chatMode: index === 0 ? 'hard' : 'tutor',
      })
    )
    const report = buildAggregateReport({
      core: core(users),
      messages: users,
      purpose: 'learning-analytics',
      window,
    })

    expect(report.dimensions.chatModes.suppressed).toBe(true)
    expect(report.summary.userMessages).toBeNull()
    expect(report.summary.eligibleMessages).toBeNull()
    expect(report.summary.creditsInternalUnits).toBeNull()
  })

  it('suppresses every user-population dimension when any user cell is hidden', () => {
    const users = Array.from({ length: 10 }, (_, index) =>
      message(`user-${index}`, {
        participantId: `participant-${index}`,
        chatMode: 'tutor',
        attachmentCount: index === 0 ? 1 : 0,
      })
    )
    const report = buildAggregateReport({
      core: core(users),
      messages: users,
      purpose: 'learning-analytics',
      window,
    })

    expect(report.dimensions.attachmentModality.suppressed).toBe(true)
    expect(
      report.dimensions.chatModes.rows.every((row) => row.value === null)
    ).toBe(true)
    expect(report.dimensions.selectedModels.rows).toEqual([])
    expect(report.summary.userMessages).toBeNull()
    expect(report.summary.exchanges).toEqual({
      linked: null,
      ambiguous: null,
      absent: null,
      outside_window: null,
    })
  })

  it('suppresses additive rating and exchange partitions independently', () => {
    const users = Array.from({ length: 25 }, (_, index) =>
      message(`user-${index}`, {
        participantId: `participant-${index}`,
        chatMode: 'tutor',
      })
    )
    const report = buildAggregateReport({
      core: {
        ...core(users),
        exchanges: users.map((user, index) => ({
          userMessage: user,
          assistantMessage: null,
          status:
            index < 12
              ? ('linked' as const)
              : index < 14
                ? ('ambiguous' as const)
                : ('absent' as const),
          candidateAssistantIds: [],
        })),
        ratingCoverage: {
          ratedResponses: 12,
          unratedResponses: 0,
          up: 10,
          down: 2,
          coverage: 1,
        },
      },
      messages: users,
      purpose: 'learning-analytics',
      window,
      minimumCellSize: 5,
    })

    expect(report.summary.exchanges).toEqual({
      linked: null,
      ambiguous: null,
      absent: null,
      outside_window: null,
    })
    expect(report.summary.ratingCoverage).toEqual({
      ratedResponses: null,
      unratedResponses: null,
      up: null,
      down: null,
      coverage: null,
    })
    expect(report.privacy.suppressedTables).toEqual(
      expect.arrayContaining(['summary.exchanges', 'summary.ratingCoverage'])
    )
  })

  it('suppresses the message-role partition when one role is small', () => {
    const users = Array.from({ length: 6 }, (_, index) =>
      message(`user-${index}`, {
        participantId: `participant-${index}`,
        chatMode: 'tutor',
      })
    )
    const assistant = message('assistant', {
      role: 'assistant',
      parentId: 'user-0',
      modelId: 'model-a',
      participantId: 'participant-0',
    })
    const report = buildAggregateReport({
      core: {
        ...core([...users, assistant]),
        exchanges: users.map((user, index) => ({
          userMessage: user,
          assistantMessage: index === 0 ? assistant : null,
          status: index === 0 ? ('linked' as const) : ('absent' as const),
          candidateAssistantIds: index === 0 ? ['assistant'] : [],
        })),
      },
      messages: [...users, assistant],
      purpose: 'learning-analytics',
      window,
    })

    expect(report.summary.eligibleMessages).toBeNull()
    expect(report.summary.userMessages).toBeNull()
    expect(report.summary.assistantMessages).toBeNull()
  })

  it('suppresses exploratory signal counts in the default aggregate', () => {
    const report = buildAggregateReport({
      core: core([message('user')]),
      messages: [message('user')],
      purpose: 'learning-analytics',
      window,
      exploratorySignals: [
        {
          name: 'asks-for-explanation',
          assignedMessages: 2,
          eligibleMessages: 6,
          coverage: 1 / 3,
          stability: 0.9,
          validated: false,
        },
      ],
    })

    expect(report.exploratorySignals[0]).toMatchObject({
      assignedMessages: null,
      eligibleMessages: null,
      coverage: null,
      validated: false,
    })
  })

  it('cascades suppression when selected-model cells are small', () => {
    const users = Array.from({ length: 6 }, (_, index) =>
      message(`user-${index}`, {
        threadId: 'thread-1',
        participantId: `participant-${index}`,
        chatMode: 'tutor',
      })
    )
    const assistants = users.map((user, index) =>
      message(`assistant-${index}`, {
        threadId: 'thread-1',
        participantId: user.participantId,
        role: 'assistant',
        parentId: user.id,
        modelId: index < 4 ? 'model-a' : 'model-b',
        rating: 'UP',
      })
    )
    const allMessages = [...users, ...assistants]
    const report = buildAggregateReport({
      core: {
        ...core(allMessages),
        exchanges: users.map((user, index) => ({
          userMessage: user,
          assistantMessage: assistants[index]!,
          status: 'linked' as const,
          candidateAssistantIds: [assistants[index]!.id],
        })),
        ratingCoverage: {
          ratedResponses: 6,
          unratedResponses: 0,
          up: 6,
          down: 0,
          coverage: 1,
        },
      },
      messages: allMessages,
      purpose: 'learning-analytics',
      window,
    })

    expect(report.dimensions.selectedModels.suppressed).toBe(true)
    expect(report.dimensions.chatModes.suppressed).toBe(true)
    expect(report.summary.userMessages).toBeNull()
    expect(report.summary.assistantMessages).toBeNull()
    expect(report.summary.eligibleMessages).toBeNull()
    expect(report.summary.exchanges.linked).toBeNull()
    expect(report.summary.ratingCoverage).toEqual({
      ratedResponses: null,
      unratedResponses: null,
      up: null,
      down: null,
      coverage: null,
    })
    expect(report.summary.creditsInternalUnits).toBeNull()
    expect(report.summary.attachments).toBeNull()
    expect(report.summary.participants).toBeNull()
    expect(report.summary.conversations).toBeNull()
    expect(report.summary.exchanges).toEqual({
      linked: null,
      ambiguous: null,
      absent: null,
      outside_window: null,
    })
    expect(
      report.provenance.find(
        (entry) => entry.field === 'summary.eligibleMessages'
      )?.unknownCount
    ).toBeNull()
    expect(
      report.provenance.find((entry) => entry.field === 'dimensions.chatModes')
        ?.unknownCount
    ).toBeNull()
    expect(
      report.provenance.find(
        (entry) => entry.field === 'dimensions.selectedModels'
      )?.unknownCount
    ).toBeNull()
    expect(
      report.provenance.find(
        (entry) => entry.field === 'summary.ratingCoverage'
      )?.unknownCount
    ).toBeNull()
  })

  it('resolves linked model fields from the report records by id', () => {
    const user = message('user', { chatMode: 'tutor' })
    const assistant = message('assistant', {
      role: 'assistant',
      parentId: 'user',
      modelId: 'model-a',
    })
    const secondUser = message('user-2', {
      chatMode: 'tutor',
      participantId: 'participant-2',
    })
    const secondAssistant = message('assistant-2', {
      role: 'assistant',
      parentId: 'user-2',
      modelId: 'model-a',
      participantId: 'participant-2',
    })
    const extraUsers = Array.from({ length: 6 }, (_, index) =>
      message(`extra-user-${index}`, {
        chatMode: 'tutor',
        participantId: `extra-participant-${index}`,
      })
    )
    const report = buildAggregateReport({
      core: {
        ...core([user, assistant, secondUser, secondAssistant, ...extraUsers]),
        exchanges: [
          {
            userMessage: { ...user },
            assistantMessage: { ...assistant },
            status: 'linked',
            candidateAssistantIds: ['assistant'],
          },
          {
            userMessage: { ...secondUser },
            assistantMessage: { ...secondAssistant },
            status: 'linked',
            candidateAssistantIds: ['assistant-2'],
          },
          ...extraUsers.slice(0, 2).map((extraUser) => ({
            userMessage: extraUser,
            assistantMessage: null,
            status: 'absent' as const,
            candidateAssistantIds: [],
          })),
          ...extraUsers.slice(2, 4).map((extraUser) => ({
            userMessage: extraUser,
            assistantMessage: null,
            status: 'ambiguous' as const,
            candidateAssistantIds: [],
          })),
          ...extraUsers.slice(4).map((extraUser) => ({
            userMessage: extraUser,
            assistantMessage: null,
            status: 'outside_window' as const,
            candidateAssistantIds: [],
          })),
        ],
      },
      messages: [user, assistant, secondUser, secondAssistant, ...extraUsers],
      purpose: 'learning-analytics',
      window,
      minimumCellSize: 2,
    })

    expect(report.dimensions.selectedModels.rows).toEqual([
      { label: 'model-a', value: 2 },
    ])
  })

  it('rejects the historical raw-content export flag', () => {
    expect(() => assertLegacyMessageContentExportDisabled(false)).not.toThrow()
    expect(() => assertLegacyMessageContentExportDisabled(true)).toThrow(
      '--includeMessageContent is disabled'
    )
  })

  it('runs the aggregate path from a synthetic provider to JSON and XLSX', async () => {
    const messages = Array.from({ length: 5 }, (_, index) =>
      message(`synthetic-user-${index}`, {
        participantId: `synthetic-participant-${index}`,
        threadId: `synthetic-thread-${index}`,
        chatMode: 'tutor',
      })
    )
    const provider: AnalysisRecordProvider = {
      loadMessages: async () => messages,
      loadEligibility: async () =>
        messages.map((value) => eligible(value.participantId)),
    }
    const output = await mkdtemp(`${tmpdir()}/chatbot-learning-analytics-`)
    const result = await runAggregateReport({
      provider,
      purpose: 'learning-analytics',
      window,
      outDir: output,
      filePrefix: 'synthetic-aggregate',
    })

    expect(result.files.jsonPath).toMatch(/synthetic-aggregate\.json$/)
    expect(result.files.workbookPath).toMatch(/synthetic-aggregate\.xlsx$/)
    expect(result.report.summary.eligibleMessages).toBe(5)
    const jsonText = await readFile(result.files.jsonPath, 'utf8')
    expect(JSON.parse(jsonText)).toEqual(result.report)
    expect((await stat(result.files.workbookPath)).size).toBeGreaterThan(0)
    const workbookText = await readFile(result.files.workbookPath, 'latin1')
    for (const sensitiveValue of [
      messages[0]!.text,
      messages[0]!.id,
      messages[0]!.threadId,
      messages[0]!.participantId,
    ]) {
      expect(jsonText).not.toContain(sensitiveValue)
      expect(workbookText).not.toContain(sensitiveValue)
    }
  })
})
