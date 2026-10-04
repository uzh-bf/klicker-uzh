import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const specimenRoot = join(root, 'specimens')
const assessmentRoot = join(specimenRoot, 'assessment')
const researchRoot = join(specimenRoot, 'research')

await Promise.all([
  mkdir(assessmentRoot, { recursive: true }),
  mkdir(researchRoot, { recursive: true }),
])

function quoteCsv(value, delimiter) {
  if (value === null || value === undefined) return ''

  const stringValue = String(value).replace(/\r\n|\r|\n/g, ' ')
  const formulaSafe = /^\s*[=+\-@]/.test(stringValue)
    ? `'${stringValue}`
    : stringValue

  if (
    formulaSafe.includes(delimiter) ||
    formulaSafe.includes('"') ||
    formulaSafe.includes('\n')
  ) {
    return `"${formulaSafe.replaceAll('"', '""')}"`
  }

  return formulaSafe
}

function csv({ headers, rows, delimiter = ',', separatorHint = false, quoteAll = false }) {
  const encode = (value) => {
    const encoded = quoteCsv(value, delimiter)
    if (!quoteAll || encoded === '') return encoded
    if (encoded.startsWith('"')) return encoded
    return `"${encoded.replaceAll('"', '""')}"`
  }
  const lines = [
    ...(separatorHint ? [`sep=${delimiter}`] : []),
    headers.map(encode).join(delimiter),
    ...rows.map((row) => row.map(encode).join(delimiter)),
  ]

  // Both current KlickerUZH export paths write UTF-8 files with a BOM. The
  // Manage DataTable path additionally emits the Excel separator hint.
  return `\uFEFF${lines.join('\n')}\n`
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function fileReceipt(path, name, metadata = {}) {
  const content = await readFile(path)
  return {
    name,
    ...metadata,
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}

const assessmentHeaders = [
  'Studierende (E-Mail)',
  'Vorname der studierenden Person',
  'Nachname der studierenden Person',
  'Matrikelnummer der studierenden Person',
  'Basispunkte',
  'Korrektheitspunkte',
  'Bonuspunkte',
  'Total',
]
const assessmentRows = [
  ['pruefling-001@example.invalid', 'Alex', 'Beispiel', '99000001', 40, 32, 3, 75],
  ['pruefling-002@example.invalid', 'Sam', 'Muster', '99000002', 40, 28, 2, 70],
  ['pruefling-003@example.invalid', 'Kim', 'Demo', '99000003', 40, 24, 4, 68],
]
const assessmentPath = join(assessmentRoot, 'assessment-results.csv')
await writeFile(
  assessmentPath,
  csv({
    headers: assessmentHeaders,
    rows: assessmentRows,
    delimiter: ';',
    separatorHint: true,
    quoteAll: true,
  }),
  'utf8'
)

const assessmentReceipt = await fileReceipt(
  assessmentPath,
  'assessment-results.csv',
  { rowCount: assessmentRows.length }
)
await writeJson(join(assessmentRoot, 'manifest.json'), {
  schemaVersion: 'assessment-export-manifest/1',
  status: 'synthetic-prototype',
  generatedAt: '2026-09-04T12:00:00.000Z',
  privacyClassification: 'directly-identifiable-personal-data',
  purpose: 'assessment-delivery-grading-and-required-follow-up',
  locale: 'de',
  csv: {
    encoding: 'utf-8-bom',
    delimiter: ';',
    excelSeparatorHint: true,
    fieldsQuoted: true,
  },
  sourceModels: [
    'Participation',
    'Participant',
    'ParticipantAccount',
    'LiveQuizResponse',
    'AppliedPointCorrection',
  ],
  fieldSources: {
    participantEmail:
      'ParticipantAccount.ssoEmail with Participant.email fallback',
    assessmentGivenName: 'Participation.assessmentGivenName',
    assessmentSurname: 'Participation.assessmentSurname',
    assessmentMatriculationNumber:
      'Participation.assessmentMatriculationNumber',
    basePoints: 'sum of LiveQuizResponse.basePoints',
    correctnessPoints: 'sum of LiveQuizResponse.correctnessPoints',
    bonusPoints: 'sum of LiveQuizResponse.bonusPoints',
    totalPoints: 'basePoints + correctnessPoints + bonusPoints',
  },
  artifactLogging: {
    proposedBackendArtifact: true,
    currentManageDownloadIsBrowserGenerated: true,
    note: 'The exact-artifact checksum is a proposed backend control. The current Manage download does not produce this manifest.',
  },
  rowCount: assessmentRows.length,
  files: [assessmentReceipt],
})

const liveQuizHeaders = [
  'participantPseudonym',
  'liveQuizPseudonym',
  'itemPseudonym',
  'elementType',
  'blockExecution',
  'correctness',
  'basePoints',
  'correctnessPoints',
  'bonusPoints',
  'totalPoints',
  'correctionOnly',
  'submittedDay',
  'responseChoices',
  'responseValue',
  'responseSelection',
  'responseAssessment',
]
const liveQuizRows = [
  [
    'person_projectA_001',
    'quiz_projectA_001',
    'item_projectA_001',
    'MC',
    1,
    'CORRECT',
    10,
    10,
    2,
    22,
    false,
    '2026-04-14',
    '1,3',
    '',
    '',
    '',
  ],
  [
    'person_projectA_002',
    'quiz_projectA_001',
    'item_projectA_001',
    'MC',
    1,
    'WRONG',
    10,
    0,
    1,
    11,
    false,
    '2026-04-14',
    '2',
    '',
    '',
    '',
  ],
  [
    'person_projectA_001',
    'quiz_projectA_001',
    'item_projectA_002',
    'NUMERICAL',
    1,
    'PARTIAL',
    10,
    5,
    0,
    15,
    false,
    '2026-04-14',
    '',
    '1040.40',
    '',
    '',
  ],
]
const liveQuizPath = join(researchRoot, 'live-quiz-responses.csv')
await writeFile(
  liveQuizPath,
  csv({ headers: liveQuizHeaders, rows: liveQuizRows }),
  'utf8'
)

const asyncHeaders = [
  'participantPseudonym',
  'activityType',
  'activityPseudonym',
  'itemPseudonym',
  'trialsCount',
  'totalScore',
  'totalPointsAwarded',
  'totalXpAwarded',
  'averageTimeSpent',
  'correctCount',
  'partialCorrectCount',
  'wrongCount',
  'firstResponseCorrectness',
  'lastResponseCorrectness',
  'lastAnsweredDay',
  'eFactor',
  'interval',
  'nextDueDay',
]
const asyncRows = [
  [
    'person_projectA_001',
    'PRACTICE_QUIZ',
    'practice_projectA_001',
    'item_projectA_021',
    3,
    2,
    20,
    15,
    18.4,
    2,
    0,
    1,
    'WRONG',
    'CORRECT',
    '2026-04-16',
    2.6,
    6,
    '2026-04-22',
  ],
  [
    'person_projectA_002',
    'MICRO_LEARNING',
    'micro_projectA_001',
    'item_projectA_022',
    2,
    1,
    10,
    8,
    24.1,
    1,
    0,
    1,
    'WRONG',
    'CORRECT',
    '2026-04-17',
    2.5,
    3,
    '2026-04-20',
  ],
]
const asyncPath = join(researchRoot, 'asynchronous-question-responses.csv')
await writeFile(
  asyncPath,
  csv({ headers: asyncHeaders, rows: asyncRows }),
  'utf8'
)

const learningAnalyticsHeaders = [
  'coursePseudonym',
  'activityPseudonym',
  'activityType',
  'eligibleParticipantCount',
  'startedCount',
  'completedCount',
  'repeatedCount',
  'firstWrongRate',
  'firstPartialRate',
  'firstCorrectRate',
  'lastWrongRate',
  'lastPartialRate',
  'lastCorrectRate',
  'totalWrongRate',
  'totalPartialRate',
  'totalCorrectRate',
  'computedDay',
]
const learningAnalyticsRows = [
  ['course_projectA_001', 'activity_projectA_001', 'PRACTICE_QUIZ', 38, 35, 27, 12, 0.29, 0.14, 0.57, 0.18, 0.11, 0.71, 0.23, 0.13, 0.64, '2026-04-18'],
  ['course_projectA_001', 'activity_projectA_002', 'MICRO_LEARNING', 36, 31, 22, '', '', '', '', '', '', '', 0.42, 0.17, 0.41, '2026-04-18'],
  ['course_projectA_002', 'activity_projectA_003', 'PRACTICE_QUIZ', 4, '', '', '', '', '', '', '', '', '', '', '', '', '2026-04-18'],
]
const learningAnalyticsPath = join(researchRoot, 'learning-analytics-groups.csv')
await writeFile(
  learningAnalyticsPath,
  csv({
    headers: learningAnalyticsHeaders,
    rows: learningAnalyticsRows,
  }),
  'utf8'
)

const chatTranscript = {
  schemaVersion: 'research-chat-transcript/1',
  privacy: {
    classification: 'pseudonymised-personal-data',
    warning:
      'Identifiers are project-specific pseudonyms. Message text is unchanged and may contain information entered by participants. This export is not anonymous.',
  },
  sourceModels: ['Chatbot', 'ChatThread', 'ChatMessage', 'ChatAttachment'],
  excludedFields: [
    'Chatbot.openaiApiKey',
    'ChatbotMCPServer.authSecret',
    'ChatAttachment.imageBase64',
    'ChatAttachment.imagePreviewBase64',
    'ChatMessage.lifecycleAttemptId',
  ],
  chatbots: [
    {
      chatbotPseudonym: 'chatbot_projectA_001',
      name: 'Synthetischer Lernchatbot',
      threads: [
        {
          threadPseudonym: 'thread_projectA_001',
          participantPseudonym: 'person_projectA_001',
          title: 'Synthetische Frage zur Zinsrechnung',
          createdAt: '2026-04-14T10:00:00.000Z',
          updatedAt: '2026-04-14T10:01:00.000Z',
          messages: [
            {
              messagePseudonym: 'message_projectA_001',
              parentMessagePseudonym: null,
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Wie berechne ich den Zinseszins in diesem Beispiel?',
                },
              ],
              chatMode: 'tutor',
              modelId: 'example-model',
              reasoningEffort: null,
              reasoningContent: null,
              creditsUsed: null,
              lifecycleStatus: 'COMPLETED',
              rating: null,
              createdAt: '2026-04-14T10:00:00.000Z',
              updatedAt: '2026-04-14T10:00:00.000Z',
              attachments: [],
            },
            {
              messagePseudonym: 'message_projectA_002',
              parentMessagePseudonym: 'message_projectA_001',
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Welche Werte für Kapital, Zinssatz und Laufzeit kennst du schon?',
                },
              ],
              chatMode: 'tutor',
              modelId: 'example-model',
              reasoningEffort: 'medium',
              reasoningContent: null,
              creditsUsed: '0.200000',
              lifecycleStatus: 'COMPLETED',
              rating: 'UP',
              createdAt: '2026-04-14T10:01:00.000Z',
              updatedAt: '2026-04-14T10:01:00.000Z',
              attachments: [],
            },
          ],
        },
      ],
    },
  ],
}
const chatPath = join(researchRoot, 'chat-transcripts.json')
await writeJson(chatPath, chatTranscript)

const researchFiles = await Promise.all([
  fileReceipt(liveQuizPath, 'live-quiz-responses.csv', {
    rowCount: liveQuizRows.length,
  }),
  fileReceipt(asyncPath, 'asynchronous-question-responses.csv', {
    rowCount: asyncRows.length,
  }),
  fileReceipt(learningAnalyticsPath, 'learning-analytics-groups.csv', {
    rowCount: learningAnalyticsRows.length,
  }),
  fileReceipt(chatPath, 'chat-transcripts.json', {
    chatbotCount: chatTranscript.chatbots.length,
    threadCount: chatTranscript.chatbots.reduce(
      (count, chatbot) => count + chatbot.threads.length,
      0
    ),
    messageCount: chatTranscript.chatbots.reduce(
      (count, chatbot) =>
        count +
        chatbot.threads.reduce(
          (threadCount, thread) => threadCount + thread.messages.length,
          0
        ),
      0
    ),
  }),
])

await writeJson(join(researchRoot, 'data-dictionary.json'), {
  schemaVersion: 'research-export-data-dictionary/1',
  commonTransformations: {
    participantPseudonym:
      'Project-specific keyed pseudonym derived from Participant.id; the key is not exported.',
    objectPseudonyms:
      'Project-specific keyed pseudonyms derived from operational activity, item, course, chatbot, thread, and message identifiers.',
    dayFields: 'Operational timestamps coarsened to a calendar date.',
  },
  files: {
    'live-quiz-responses.csv': {
      sourceModels: ['LiveQuizResponse', 'ElementInstance', 'ElementBlock', 'LiveQuiz'],
      excludedByDefault: [
        'raw response JSON',
        'free-text response values',
        'operational database identifiers',
        'exact timestamps',
      ],
    },
    'asynchronous-question-responses.csv': {
      sourceModels: ['QuestionResponse', 'ElementInstance', 'PracticeQuiz', 'MicroLearning'],
      note: 'One derived row per participant and element instance. Attempt-level QuestionResponseDetail rows are not included.',
    },
    'learning-analytics-groups.csv': {
      sourceModels: ['ActivityProgress', 'ActivityPerformance'],
      disclosureControl: {
        minimumEligibleGroupSize: 5,
        complementarySuppression: true,
      },
      note: 'One cohort-level row per activity. Empty metrics show a group below the example threshold, not missing participant records. The release projection must be recalculated from the currently eligible population; existing aggregate rows cannot be exported unchanged. The export contains no participant key or participant-level error details.',
    },
    'chat-transcripts.json': {
      sourceModels: ['Chatbot', 'ChatThread', 'ChatMessage', 'ChatAttachment'],
      note: 'Pseudonymisation covers identifiers, not free text. Image payloads, provider secrets, and lifecycle attempt IDs are excluded.',
    },
  },
})

const dataDictionaryReceipt = await fileReceipt(
  join(researchRoot, 'data-dictionary.json'),
  'data-dictionary.json'
)
await writeJson(join(researchRoot, 'manifest.json'), {
  schemaVersion: 'research-export-manifest/3',
  status: 'synthetic-prototype',
  generatedAt: '2026-09-04T12:00:00.000Z',
  sourceBaseline: 'origin/v3@795568a4a1155991d4f2909c5903cd15735e23b4',
  privacyClassification: 'pseudonymised-personal-data',
  anonymous: false,
  project: {
    title: 'Adaptive Wiederholung in Grundlagenvorlesungen',
    responsiblePerson: 'Dr. Beispiel',
    contact: 'research-lead@example.invalid',
    purpose:
      'Wirkung adaptiver Wiederholungsempfehlungen auf Lernerfolg in synthetischen Grundlagenmodulen',
    retainUntil: '2029-12-31',
  },
  pseudonymisation: {
    scope: 'project',
    keyVersion: 'k2026-09',
    keyIncluded: false,
  },
  timestampPrecision: {
    quizAndLearningRows: 'day',
    chatTranscripts: 'exact synthetic timestamps in this review specimen',
  },
  eligibility: {
    rule: 'Include only participants whose global research choice is ALLOWED when the backend releases the artifact.',
    implementationStatus:
      'proposed control; the participant research-choice field is not present on origin/v3',
    revision: '2026-09-04T11:59:58.000Z',
  },
  selectedDataClasses: [
    'live-quiz-responses',
    'asynchronous-question-responses',
    'learning-analytics-group-summaries',
    'chat-transcripts',
  ],
  learningAnalyticsDisclosure: {
    participantRowsIncluded: false,
    participantErrorDetailsIncluded: false,
    minimumEligibleGroupSize: 5,
    complementarySuppression: true,
    status: 'proposed control for DPO review',
  },
  files: [...researchFiles, dataDictionaryReceipt],
})

console.log(`Wrote synthetic assessment and research specimens to ${specimenRoot}`)
