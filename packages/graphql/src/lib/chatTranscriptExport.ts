// Lecturer export of the stored conversations of one chatbot, reconciled
// against the course roster so graders can see who has no, one or several
// conversations. Only participant-visible text is exported: reasoning, tool
// internals and prompt bodies never leave the server through this path.

// Same rule as the chat app's stored-content filter: reasoning parts never
// leave the server.
function withoutReasoningParts(content: unknown): unknown {
  if (!Array.isArray(content)) return content

  return content.filter(
    (part) =>
      !(
        part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'reasoning'
      )
  )
}

export type ExportMessage = {
  id: string
  parentId: string | null
  role: string
  content: unknown
  chatMode: string | null
  modelId: string | null
  lifecycleStatus: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  attachmentTypes: string[]
  createdAt: Date
}

export type ExportThread = {
  id: string
  participantId: string
  title: string | null
  createdAt: Date
  messages: ExportMessage[]
}

export type ExportRosterEntry = {
  participantId: string | null
  username: string | null
  email: string | null
  invitationEmail: string | null
  invitationMatriculationNumber: string | null
  assessmentGivenName: string | null
  assessmentSurname: string | null
  assessmentMatriculationNumber: string | null
  // false for an invitation the student never accepted
  joined: boolean
}

export type ExportMetadata = {
  chatbotId: string
  chatbotName: string
  courseId: string
  courseName: string
  exportedAt: Date
  windowFrom: Date | null
  windowTo: Date | null
}

export type ExportedMessage = {
  id: string
  parentId: string | null
  // Position in the message tree: "1" for the main line, "1.2" for the
  // second alternative after a branch point, and so on.
  branch: string
  role: string
  text: string
  chatMode: string | null
  modelId: string | null
  status: 'complete' | 'incomplete' | 'failed'
  attachments: string[]
  createdAt: string
}

export type ExportedThread = {
  id: string
  title: string | null
  createdAt: string
  hasBranches: boolean
  messages: ExportedMessage[]
}

export type ExportedStudent = {
  participantId: string | null
  identity: {
    givenName: string | null
    surname: string | null
    matriculationNumber: string | null
    email: string | null
    username: string | null
    // 'assessment' when edu-ID identity was captured at login; otherwise
    // the export falls back to invitation or account data.
    source: 'assessment' | 'invitation' | 'account' | 'missing'
  }
  rosterStatus: 'participant' | 'invited, not joined' | 'not in roster'
  conversationStatus: 'no conversation' | 'one' | 'several'
  incompleteAnswers: number
  failedAnswers: number
  // Name of this student's JSON file inside the archive; built from the
  // participant id and the position, never from identity data.
  file: string
  messageCount: number
  firstMessageAt: string | null
  lastMessageAt: string | null
  attachmentCount: number
  threads: ExportedThread[]
}

export type ConversationExport = {
  metadata: {
    chatbotId: string
    chatbotName: string
    courseId: string
    courseName: string
    exportedAt: string
    windowFrom: string | null
    windowTo: string | null
    notes: string[]
  }
  students: ExportedStudent[]
}

export const EXPORT_NOTES = [
  'Only messages created at or before exportedAt (and inside the window, if set) are included.',
  'Deleted conversations are removed from the database and cannot be exported.',
  'Model reasoning, tool internals and system prompts are not included.',
  'Image attachments are listed by type, not embedded.',
]

export function extractVisibleText(content: unknown): string {
  const parts = withoutReasoningParts(content)
  if (typeof parts === 'string') return parts
  if (!Array.isArray(parts)) return ''
  return parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        !!part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string'
    )
    .map((part) => part.text)
    .join('\n\n')
}

function messageStatus(
  message: Pick<ExportMessage, 'lifecycleStatus' | 'content'>
): ExportedMessage['status'] {
  if (message.lifecycleStatus === 'IN_PROGRESS') return 'incomplete'
  if (message.lifecycleStatus === 'FAILED') return 'failed'
  // A student-stopped answer is stored as COMPLETED with a marker part.
  if (
    Array.isArray(message.content) &&
    message.content.some(
      (part) =>
        !!part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'data' &&
        (part as { name?: unknown }).name === 'chat-stopped'
    )
  ) {
    return 'incomplete'
  }
  return 'complete'
}

// Orders a thread's messages depth-first along the parentId tree and labels
// alternatives. In a thread without any recorded parent (rows written before
// branching was recorded) the messages form one linear chain in creation
// order. Otherwise a message without a usable parent is a root, so an edited
// first question becomes a sibling branch. Messages the walk cannot reach
// (a cyclic parentId) are appended as extra roots so none is dropped.
export function orderThreadMessages(messages: ExportMessage[]): {
  ordered: Array<{ message: ExportMessage; branch: string }>
  hasBranches: boolean
} {
  const byCreation = [...messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )
  const ids = new Set(byCreation.map((m) => m.id))
  const usableParent = (message: ExportMessage) =>
    message.parentId &&
    message.parentId !== message.id &&
    ids.has(message.parentId)
      ? message.parentId
      : null
  // Only rows without any recorded parent are legacy. A parent left out by
  // the export window still makes its answers alternatives of one turn.
  const legacyChain = byCreation.every(
    (m) => !m.parentId || m.parentId === m.id
  )
  const children = new Map<string | null, ExportMessage[]>()
  let previousRoot: string | null = null
  for (const message of byCreation) {
    let parent = usableParent(message)
    if (parent === null && legacyChain) {
      parent = previousRoot
      previousRoot = message.id
    }
    const siblings = children.get(parent) ?? []
    siblings.push(message)
    children.set(parent, siblings)
  }

  const ordered: Array<{ message: ExportMessage; branch: string }> = []
  const emitted = new Set<string>()
  let hasBranches = false
  const visit = (siblings: ExportMessage[], branch: string) => {
    if (siblings.length > 1) hasBranches = true
    siblings.forEach((message, index) => {
      if (emitted.has(message.id)) return
      emitted.add(message.id)
      const childBranch =
        siblings.length > 1 ? `${branch}.${index + 1}` : branch
      ordered.push({ message, branch: childBranch })
      visit(children.get(message.id) ?? [], childBranch)
    })
  }
  const roots = [...(children.get(null) ?? [])]
  for (const message of byCreation) {
    if (!emitted.has(message.id) && roots.length === 0) roots.push(message)
  }
  visit(roots, '1')
  let extraRoot = 1
  for (const message of byCreation) {
    if (emitted.has(message.id)) continue
    hasBranches = true
    extraRoot += 1
    visit([message], `${extraRoot}`)
  }
  return { ordered, hasBranches }
}

function identityFor(entry: ExportRosterEntry): ExportedStudent['identity'] {
  if (
    entry.assessmentGivenName ||
    entry.assessmentSurname ||
    entry.assessmentMatriculationNumber
  ) {
    return {
      givenName: entry.assessmentGivenName,
      surname: entry.assessmentSurname,
      matriculationNumber: entry.assessmentMatriculationNumber,
      email: entry.email ?? entry.invitationEmail,
      username: entry.username,
      source: 'assessment',
    }
  }
  const email = entry.invitationEmail ?? entry.email
  return {
    givenName: null,
    surname: null,
    matriculationNumber: entry.invitationMatriculationNumber,
    email,
    username: entry.username,
    source: entry.invitationEmail
      ? 'invitation'
      : email || entry.username
        ? 'account'
        : 'missing',
  }
}

// Archive entry name for one student: position plus participant id only.
// The id is reduced to a conservative alphabet so no path characters or
// traversal sequences can come from stored data.
export function studentFileName(
  participantId: string | null,
  index: number
): string {
  const position = String(index + 1).padStart(4, '0')
  const id = participantId
    ? participantId.replace(/[^A-Za-z0-9-]/g, '_').slice(0, 64)
    : 'no-account'
  return `students/${position}-${id}.json`
}

export function buildConversationExport({
  metadata,
  roster,
  threads,
}: {
  metadata: ExportMetadata
  roster: ExportRosterEntry[]
  threads: ExportThread[]
}): ConversationExport {
  const threadsByParticipant = new Map<string, ExportThread[]>()
  for (const thread of threads) {
    const list = threadsByParticipant.get(thread.participantId) ?? []
    list.push(thread)
    threadsByParticipant.set(thread.participantId, list)
  }

  const rosterIds = new Set(
    roster.map((entry) => entry.participantId).filter(Boolean)
  )
  const entries: Array<{
    entry: ExportRosterEntry
    rosterStatus: ExportedStudent['rosterStatus']
  }> = roster.map((entry) => ({
    entry,
    rosterStatus: entry.joined ? 'participant' : 'invited, not joined',
  }))
  for (const participantId of threadsByParticipant.keys()) {
    if (rosterIds.has(participantId)) continue
    entries.push({
      entry: {
        participantId,
        username: null,
        email: null,
        invitationEmail: null,
        invitationMatriculationNumber: null,
        assessmentGivenName: null,
        assessmentSurname: null,
        assessmentMatriculationNumber: null,
        joined: false,
      },
      rosterStatus: 'not in roster',
    })
  }

  const students = entries.map(
    ({ entry, rosterStatus }, index): ExportedStudent => {
      const ownThreads = entry.participantId
        ? (threadsByParticipant.get(entry.participantId) ?? [])
        : []
      const exportedThreads = ownThreads
        .filter((thread) => thread.messages.length > 0)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((thread): ExportedThread => {
          const { ordered, hasBranches } = orderThreadMessages(thread.messages)
          return {
            id: thread.id,
            title: thread.title,
            createdAt: thread.createdAt.toISOString(),
            hasBranches,
            messages: ordered.map(({ message, branch }) => ({
              id: message.id,
              parentId: message.parentId,
              branch,
              role: message.role,
              text: extractVisibleText(message.content),
              chatMode: message.chatMode,
              modelId: message.modelId,
              status: messageStatus(message),
              attachments: message.attachmentTypes,
              createdAt: message.createdAt.toISOString(),
            })),
          }
        })

      const messages = exportedThreads.flatMap((thread) => thread.messages)
      const times = messages
        .map((message) => message.createdAt)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      return {
        participantId: entry.participantId,
        identity: identityFor(entry),
        rosterStatus,
        conversationStatus:
          exportedThreads.length === 0
            ? 'no conversation'
            : exportedThreads.length === 1
              ? 'one'
              : 'several',
        incompleteAnswers: messages.filter(
          (message) =>
            message.role === 'assistant' && message.status === 'incomplete'
        ).length,
        failedAnswers: messages.filter(
          (message) =>
            message.role === 'assistant' && message.status === 'failed'
        ).length,
        file: studentFileName(entry.participantId, index),
        messageCount: messages.length,
        firstMessageAt: times[0] ?? null,
        lastMessageAt: times.at(-1) ?? null,
        attachmentCount: messages.reduce(
          (sum, message) => sum + message.attachments.length,
          0
        ),
        threads: exportedThreads,
      }
    }
  )

  return {
    metadata: {
      chatbotId: metadata.chatbotId,
      chatbotName: metadata.chatbotName,
      courseId: metadata.courseId,
      courseName: metadata.courseName,
      exportedAt: metadata.exportedAt.toISOString(),
      windowFrom: metadata.windowFrom?.toISOString() ?? null,
      windowTo: metadata.windowTo?.toISOString() ?? null,
      notes: EXPORT_NOTES,
    },
    students,
  }
}

// Spreadsheet-safe CSV cell: one physical line per row, formula prefixes
// neutralised, quoting for separators. Mirrors packages/export/src/csv.ts.
export function escapeCsvValue(value: unknown): string {
  if (value == null) return ''
  const str = String(value).replace(/\r\n|\r|\n/g, ' ')
  const sanitized = /^\s*[=+\-@\t]/.test(str) ? `'${str}` : str
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}

const INDEX_HEADERS = [
  'participantId',
  'givenName',
  'surname',
  'matriculationNumber',
  'email',
  'username',
  'identitySource',
  'rosterStatus',
  'conversationStatus',
  'threadCount',
  'messageCount',
  'incompleteAnswers',
  'failedAnswers',
  'attachmentCount',
  'firstMessageAt',
  'lastMessageAt',
  'jsonFile',
]

export function toOverviewCsv(exported: ConversationExport): string {
  const rows = exported.students.map((student) => [
    student.participantId,
    student.identity.givenName,
    student.identity.surname,
    student.identity.matriculationNumber,
    student.identity.email,
    student.identity.username,
    student.identity.source,
    student.rosterStatus,
    student.conversationStatus,
    student.threads.length,
    student.messageCount,
    student.incompleteAnswers,
    student.failedAnswers,
    student.attachmentCount,
    student.firstMessageAt,
    student.lastMessageAt,
    student.file,
  ])
  const lines = [INDEX_HEADERS, ...rows].map((row) =>
    row.map(escapeCsvValue).join(',')
  )
  // BOM so spreadsheet applications detect UTF-8
  return `﻿${lines.join('\n')}\n`
}

// Version of the per-student JSON layout. The bundled viewer refuses files
// with a different version.
export const STUDENT_TRANSCRIPT_FORMAT_VERSION = 1

export type StudentTranscriptFile = {
  formatVersion: typeof STUDENT_TRANSCRIPT_FORMAT_VERSION
  chatbot: { id: string; name: string }
  course: { id: string; name: string }
  exportedAt: string
  notes: string[]
  student: Omit<ExportedStudent, 'threads' | 'file'>
  threads: ExportedThread[]
}

export function toStudentTranscript(
  exported: ConversationExport,
  student: ExportedStudent
): StudentTranscriptFile {
  const { metadata } = exported
  const { threads, file: _file, ...rest } = student
  return {
    formatVersion: STUDENT_TRANSCRIPT_FORMAT_VERSION,
    chatbot: { id: metadata.chatbotId, name: metadata.chatbotName },
    course: { id: metadata.courseId, name: metadata.courseName },
    exportedAt: metadata.exportedAt,
    notes: metadata.notes,
    student: rest,
    threads,
  }
}
