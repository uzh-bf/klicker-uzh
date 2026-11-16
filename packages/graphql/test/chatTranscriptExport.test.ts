import { describe, expect, it } from 'vitest'
import {
  buildConversationExport,
  type ExportMessage,
  type ExportRosterEntry,
  escapeCsvValue,
  extractVisibleText,
  orderThreadMessages,
  STUDENT_TRANSCRIPT_FORMAT_VERSION,
  studentFileName,
  toOverviewCsv,
  toStudentTranscript,
} from '../src/lib/chatTranscriptExport.js'

const metadata = {
  chatbotId: 'bot',
  chatbotName: 'Case bot',
  courseId: 'course',
  courseName: 'Course',
  exportedAt: new Date('2026-12-16T10:00:00Z'),
  windowFrom: null,
  windowTo: null,
}

function message(
  id: string,
  minute: number,
  overrides: Partial<ExportMessage> = {}
): ExportMessage {
  return {
    id,
    parentId: null,
    role: 'user',
    content: [{ type: 'text', text: id }],
    chatMode: 'exam',
    modelId: 'model',
    lifecycleStatus: 'COMPLETED',
    attachmentTypes: [],
    createdAt: new Date(Date.UTC(2026, 11, 16, 9, minute)),
    ...overrides,
  }
}

function rosterEntry(
  overrides: Partial<ExportRosterEntry> = {}
): ExportRosterEntry {
  return {
    participantId: 'p1',
    username: 'student1',
    email: null,
    invitationEmail: null,
    invitationMatriculationNumber: null,
    assessmentGivenName: null,
    assessmentSurname: null,
    assessmentMatriculationNumber: null,
    joined: true,
    ...overrides,
  }
}

describe('extractVisibleText', () => {
  it('drops reasoning and tool parts and keeps visible text', () => {
    expect(
      extractVisibleText([
        { type: 'reasoning', text: 'hidden chain' },
        { type: 'tool-doc_query', input: {} },
        { type: 'text', text: 'visible answer' },
      ])
    ).toBe('visible answer')
  })
})

describe('orderThreadMessages', () => {
  it('labels alternatives after an edited or regenerated turn', () => {
    const { ordered, hasBranches } = orderThreadMessages([
      message('q1', 0),
      message('a1', 1, { parentId: 'q1', role: 'assistant' }),
      message('a1-retry', 2, { parentId: 'q1', role: 'assistant' }),
    ])

    expect(hasBranches).toBe(true)
    expect(ordered.map(({ message, branch }) => [message.id, branch])).toEqual([
      ['q1', '1'],
      ['a1', '1.1'],
      ['a1-retry', '1.2'],
    ])
  })

  it('treats parentless legacy rows as one linear conversation', () => {
    const { ordered, hasBranches } = orderThreadMessages([
      message('second', 2),
      message('first', 1),
    ])

    expect(hasBranches).toBe(false)
    expect(ordered.map(({ message }) => message.id)).toEqual([
      'first',
      'second',
    ])
  })

  it('keeps alternatives apart when the window excludes their question', () => {
    const { hasBranches } = orderThreadMessages([
      message('a1', 1, { parentId: 'q1', role: 'assistant' }),
      message('a1-retry', 2, { parentId: 'q1', role: 'assistant' }),
    ])

    expect(hasBranches).toBe(true)
  })

  it('keeps an edited first question as a sibling branch', () => {
    const { ordered, hasBranches } = orderThreadMessages([
      message('q1', 0),
      message('a1', 1, { parentId: 'q1', role: 'assistant' }),
      message('q1-edit', 2),
      message('a1-edit', 3, { parentId: 'q1-edit', role: 'assistant' }),
    ])

    expect(hasBranches).toBe(true)
    expect(ordered.map(({ message, branch }) => [message.id, branch])).toEqual([
      ['q1', '1.1'],
      ['a1', '1.1'],
      ['q1-edit', '1.2'],
      ['a1-edit', '1.2'],
    ])
  })

  it('exports messages caught in a parent cycle', () => {
    const { ordered } = orderThreadMessages([
      message('q1', 0),
      message('x', 1, { parentId: 'y' }),
      message('y', 2, { parentId: 'x' }),
      message('self', 3, { parentId: 'self' }),
    ])

    expect(ordered.map(({ message }) => message.id).sort()).toEqual([
      'q1',
      'self',
      'x',
      'y',
    ])
  })
})

describe('buildConversationExport status', () => {
  it('marks a student-stopped answer as incomplete', () => {
    const result = buildConversationExport({
      metadata,
      roster: [rosterEntry()],
      threads: [
        {
          id: 't1',
          participantId: 'p1',
          title: null,
          createdAt: new Date(Date.UTC(2026, 11, 16, 9, 0)),
          messages: [
            message('q1', 0),
            message('a1', 1, {
              parentId: 'q1',
              role: 'assistant',
              content: [
                { type: 'text', text: 'partial' },
                { type: 'data', name: 'chat-stopped', data: {} },
              ],
            }),
          ],
        },
      ],
    })

    const student = result.students[0]!
    expect(student.incompleteAnswers).toBe(1)
    expect(student.threads[0]!.messages[1]!.status).toBe('incomplete')
  })
})

describe('buildConversationExport', () => {
  it('reconciles the roster without choosing among several conversations', () => {
    const exported = buildConversationExport({
      metadata,
      roster: [
        rosterEntry({
          participantId: 'p1',
          assessmentGivenName: 'Ada',
          assessmentSurname: 'Example',
          assessmentMatriculationNumber: '00-000-001',
        }),
        rosterEntry({ participantId: 'p2', username: 'student2' }),
        rosterEntry({
          participantId: null,
          username: null,
          invitationEmail: 'invited@example.org',
          joined: false,
        }),
      ],
      threads: [
        {
          id: 't1',
          participantId: 'p1',
          title: null,
          createdAt: new Date('2026-12-16T09:00:00Z'),
          messages: [
            message('q1', 0),
            message('a1', 1, {
              parentId: 'q1',
              role: 'assistant',
              lifecycleStatus: 'FAILED',
            }),
          ],
        },
        {
          id: 't2',
          participantId: 'p1',
          title: null,
          createdAt: new Date('2026-12-16T09:10:00Z'),
          messages: [message('q2', 10, { attachmentTypes: ['IMAGE'] })],
        },
        {
          id: 't3',
          participantId: 'outsider',
          title: null,
          createdAt: new Date('2026-12-16T09:20:00Z'),
          messages: [message('q3', 20)],
        },
      ],
    })

    const byId = new Map(
      exported.students.map((student) => [
        student.participantId ?? student.identity.email,
        student,
      ])
    )
    expect(byId.get('p1')).toMatchObject({
      conversationStatus: 'several',
      incompleteAnswers: 0,
      failedAnswers: 1,
      attachmentCount: 1,
      identity: { source: 'assessment', matriculationNumber: '00-000-001' },
    })
    expect(byId.get('p2')).toMatchObject({
      conversationStatus: 'no conversation',
      identity: { source: 'account' },
    })
    expect(byId.get('invited@example.org')).toMatchObject({
      rosterStatus: 'invited, not joined',
      identity: { source: 'invitation' },
    })
    expect(byId.get('outsider')).toMatchObject({
      rosterStatus: 'not in roster',
      identity: { source: 'missing' },
    })
  })
})

describe('serialization', () => {
  it('neutralises spreadsheet formulas and quotes separators', () => {
    expect(escapeCsvValue('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCsvValue('\t=cmd')).toBe("'\t=cmd")
    expect(escapeCsvValue('a,"b"')).toBe('"a,""b"""')
    expect(
      toOverviewCsv(
        buildConversationExport({ metadata, roster: [], threads: [] })
      ).startsWith('﻿')
    ).toBe(true)
  })

  it('lists every roster entry in the overview with its JSON file', () => {
    const exported = buildConversationExport({
      metadata,
      roster: [
        rosterEntry({ assessmentGivenName: '=Ada' }),
        rosterEntry({ participantId: null, joined: false }),
      ],
      threads: [],
    })
    const lines = toOverviewCsv(exported).trim().split('\n')

    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('failedAnswers')
    expect(lines[1]).toContain("'=Ada")
    expect(lines[1]).toContain(exported.students[0]!.file)
    expect(lines[2]).toContain(exported.students[1]!.file)
  })

  it('names archive entries from id and position without path characters', () => {
    expect(studentFileName('p1', 0)).toBe('students/0001-p1.json')
    expect(studentFileName(null, 11)).toBe('students/0012-no-account.json')
    const hostile = studentFileName('../../etc/passwd', 2)
    expect(hostile.slice('students/'.length)).not.toMatch(/[/\\]|\.\./)
  })

  it('writes one JSON per student with ordered threads and no internals', () => {
    const exported = buildConversationExport({
      metadata,
      roster: [rosterEntry()],
      threads: [
        {
          id: 't1',
          participantId: 'p1',
          title: null,
          createdAt: new Date('2026-12-16T09:00:00Z'),
          messages: [
            message('q1', 0),
            message('a1', 1, {
              parentId: 'q1',
              role: 'assistant',
              lifecycleStatus: 'FAILED',
              content: [
                { type: 'reasoning', text: 'hidden chain' },
                { type: 'tool-x', input: { secret: 1 } },
                { type: 'text', text: 'visible' },
              ],
            }),
          ],
        },
      ],
    })
    const file = toStudentTranscript(exported, exported.students[0]!)
    const json = JSON.stringify(file)

    expect(file.formatVersion).toBe(STUDENT_TRANSCRIPT_FORMAT_VERSION)
    expect(file.threads[0]!.messages.map((m) => [m.id, m.status])).toEqual([
      ['q1', 'complete'],
      ['a1', 'failed'],
    ])
    expect(json).not.toContain('hidden chain')
    expect(json).not.toContain('tool-x')
    expect(file.student).not.toHaveProperty('file')
  })
})
