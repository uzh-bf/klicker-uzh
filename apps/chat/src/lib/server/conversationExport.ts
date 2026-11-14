import { withoutReasoningParts } from '@/src/lib/server/persistedAssistantContent'

// Lecturer export of the stored conversations of one chatbot, reconciled
// against the course roster so graders can see who has no, one or several
// conversations. Only participant-visible text is exported: reasoning, tool
// internals and prompt bodies never leave the server through this path.

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
  const legacyChain = byCreation.every((m) => usableParent(m) === null)
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

  const students = entries.map(({ entry, rosterStatus }): ExportedStudent => {
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
          message.role === 'assistant' && message.status !== 'complete'
      ).length,
      messageCount: messages.length,
      firstMessageAt: times[0] ?? null,
      lastMessageAt: times.at(-1) ?? null,
      attachmentCount: messages.reduce(
        (sum, message) => sum + message.attachments.length,
        0
      ),
      threads: exportedThreads,
    }
  })

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
  'attachmentCount',
  'firstMessageAt',
  'lastMessageAt',
]

export function toIndexCsv(exported: ConversationExport): string {
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
    student.attachmentCount,
    student.firstMessageAt,
    student.lastMessageAt,
  ])
  const lines = [INDEX_HEADERS, ...rows].map((row) =>
    row.map(escapeCsvValue).join(',')
  )
  // BOM so spreadsheet applications detect UTF-8
  return `﻿${lines.join('\n')}\n`
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function studentLabel(student: ExportedStudent): string {
  const { identity } = student
  const name = [identity.givenName, identity.surname].filter(Boolean).join(' ')
  return (
    [name, identity.matriculationNumber, identity.email ?? identity.username]
      .filter(Boolean)
      .join(' · ') ||
    student.participantId ||
    'Unknown student'
  )
}

export function toTranscriptHtml(exported: ConversationExport): string {
  const { metadata } = exported
  const index = exported.students
    .map(
      (student, i) =>
        `<tr><td><a href="#s${i}">${escapeHtml(studentLabel(student))}</a></td><td>${escapeHtml(student.rosterStatus)}</td><td>${escapeHtml(student.conversationStatus)}</td><td>${student.messageCount}</td><td>${student.incompleteAnswers}</td></tr>`
    )
    .join('\n')

  const sections = exported.students
    .map((student, i) => {
      const threads = student.threads
        .map((thread, t) => {
          const messages = thread.messages
            .map(
              (message) =>
                `<div class="msg ${message.role === 'user' ? 'user' : 'assistant'}"><div class="meta">${escapeHtml(message.role === 'user' ? 'Student' : 'Assistant')} · ${escapeHtml(message.createdAt)}${thread.hasBranches ? ` · branch ${escapeHtml(message.branch)}` : ''}${message.status === 'complete' ? '' : ` · <strong>${escapeHtml(message.status)}</strong>`}${message.attachments.length ? ` · attachments: ${escapeHtml(message.attachments.join(', '))}` : ''}</div><div class="text">${escapeHtml(message.text)}</div></div>`
            )
            .join('\n')
          return `<h3>Conversation ${t + 1}${thread.title ? `: ${escapeHtml(thread.title)}` : ''}</h3><p class="meta">Started ${escapeHtml(thread.createdAt)}${thread.hasBranches ? ' · contains edited or regenerated branches' : ''}</p>\n${messages}`
        })
        .join('\n')
      return `<section id="s${i}"><h2>${escapeHtml(studentLabel(student))}</h2><p class="meta">${escapeHtml(student.rosterStatus)} · ${escapeHtml(student.conversationStatus)}</p>${threads || '<p>No conversation.</p>'}</section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(metadata.chatbotName)} – conversations</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;line-height:1.5}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.25rem .5rem;text-align:left}.meta{color:#555;font-size:.85rem}.msg{border-left:3px solid #ccc;margin:.75rem 0;padding:.25rem .75rem}.msg.user{border-color:#0b5394}.text{white-space:pre-wrap}section{border-top:2px solid #333;margin-top:2rem}</style>
</head><body>
<h1>${escapeHtml(metadata.chatbotName)}</h1>
<p class="meta">Course: ${escapeHtml(metadata.courseName)} · Exported ${escapeHtml(metadata.exportedAt)}${metadata.windowFrom ? ` · from ${escapeHtml(metadata.windowFrom)}` : ''}${metadata.windowTo ? ` · to ${escapeHtml(metadata.windowTo)}` : ''}</p>
<ul class="meta">${metadata.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
<table><thead><tr><th>Student</th><th>Roster</th><th>Conversations</th><th>Messages</th><th>Incomplete answers</th></tr></thead><tbody>
${index}
</tbody></table>
${sections}
</body></html>
`
}
