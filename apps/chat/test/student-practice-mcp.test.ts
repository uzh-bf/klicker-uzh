import { describe, expect, test } from 'vitest'
import {
  buildPracticeLookupContext,
  formatPracticeCandidatesForPrompt,
  getStudentPracticeMcpUrl,
  parseMcpJsonToolResult,
  toPracticeCandidateId,
} from '../src/services/studentPracticeMcp'

describe('student practice MCP adapter', () => {
  test('builds lookup context from prior conversation and the latest user turn', () => {
    const context = buildPracticeLookupContext([
      { role: 'user', content: 'Can you explain prior probability?' },
      { role: 'assistant', content: 'A prior is your belief before evidence.' },
      { role: 'user', content: 'Quiz me on Bayes posterior updates.' },
    ])

    expect(context).toEqual({
      conversationSummary:
        'user: Can you explain prior probability?\nassistant: A prior is your belief before evidence.',
      lastUserMessage: 'Quiz me on Bayes posterior updates.',
    })
  })

  test('parses JSON returned as an MCP text content result', () => {
    expect(
      parseMcpJsonToolResult({
        content: [
          {
            type: 'text',
            text: '{"candidates":[{"questionRef":"ref-1","stackTitle":"Bayes"}]}',
          },
        ],
      })
    ).toEqual({
      candidates: [{ questionRef: 'ref-1', stackTitle: 'Bayes' }],
    })
  })

  test('parses direct JSON tool results returned by local adapters', () => {
    expect(
      parseMcpJsonToolResult({
        candidates: [{ questionRef: 'ref-2', stackTitle: 'Posterior' }],
      })
    ).toEqual({
      candidates: [{ questionRef: 'ref-2', stackTitle: 'Posterior' }],
    })
  })

  test('formats compact candidate context for the tutor model', () => {
    const prompt = formatPracticeCandidatesForPrompt([
      {
        questionRef: 'signed-ref',
        stackTitle: 'Posterior update',
        sourcePracticeQuizTitle: 'Week 2 practice',
        courseId: 'course-1',
        tags: [],
        supportedElementTypes: ['SC'],
        shortQuestionPreview: 'What happens to the posterior?',
        relevanceScore: 0.75,
        srsScore: 1,
        reason: 'Matched posterior.',
      },
    ])

    expect(prompt).toContain('candidateId: practice_1')
    expect(prompt).not.toContain('signed-ref')
  })

  test('uses stable model-facing candidate ids', () => {
    expect(toPracticeCandidateId(0)).toBe('practice_1')
    expect(toPracticeCandidateId(2)).toBe('practice_3')
  })

  test('derives the development MCP URL from student MCP env vars', () => {
    expect(
      getStudentPracticeMcpUrl({
        MCP_STUDENT_PATH: 'custom-mcp',
        MCP_STUDENT_PORT: '7090',
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv)
    ).toBe('http://localhost:7090/custom-mcp')
  })
})
