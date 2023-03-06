import Prisma from '@klicker-uzh/prisma'
const { AttachmentType, QuestionType, SessionStatus, OrderType } = Prisma

export const ATTACHMENTS = [
  {
    id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0b',
    href: 'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.svg',
    name: 'Test Attachment 1',
    type: AttachmentType.SVG,
  },
  {
    id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0c',
    href: 'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.webp',
    name: 'Test Attachment 2',
    type: AttachmentType.WEBP,
  },
]

export const QUESTIONS = [
  {
    id: 0,
    name: 'Testfrage FREE_TEXT',
    content:
      'Beantworte mich korrekt, richtig, oder genau. Ansonsten bekommst du keine Punkte!',
    explanation: 'FT generische Erklärung, warum diese Frage richtig ist.',
    type: QuestionType.FREE_TEXT,
    hasSampleSolution: true,
    hasAnswerFeedbacks: false,
    options: {
      restrictions: {
        maxLength: 100,
      },
      solutions: ['korrekt', 'richtig', 'genau'],
    },
  },
  {
    id: 1,
    name: 'Testfrage MC',
    content: 'Wähle 2 und 3, denn sonst ist es vorbei.',
    explanation: 'MC generische Erklärung, warum diese Frage richtig ist.',
    type: QuestionType.MC,
    hasSampleSolution: true,
    hasAnswerFeedbacks: true,
    choices: [
      {
        feedback:
          'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
        value:
          'Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
      },
      {
        correct: true,
        feedback:
          'Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.',
        value:
          'Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens.',
      },
      {
        correct: true,
        feedback:
          'Falsch! Die Unabhängigkeit ist kein Ziel des klassischen Zieldreiecks.',
        value: 'Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks.',
      },
      {
        feedback:
          'Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
        value:
          'Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
      },
      {
        feedback:
          'Falsch! Der Shareholder Value ist kein Ziel des klassischen Zieldreiecks.',
        value:
          'Der Shareholder Value ist *kein* Ziel des klassischen Zieldreiecks.',
      },
    ],
  },
  {
    id: 2,
    name: 'Testfrage NUMERICAL',
    content: 'Wie viel würdest du in Aktien anlegen? Beni mag 17%.',
    explanation: 'NR generische Erklärung, warum diese Frage richtig ist.',
    type: QuestionType.NUMERICAL,
    hasSampleSolution: true,
    hasAnswerFeedbacks: false,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
      solutionRanges: [
        {
          min: undefined,
          max: 5,
        },
        {
          min: 10,
          max: 20,
        },
        {
          min: 95,
          max: undefined,
        },
      ],
    },
  },
  {
    id: 3,
    name: 'Multi-Faktor-Modell',
    content: '<br>',
    type: QuestionType.KPRIM,
    hasSampleSolution: true,
    hasAnswerFeedbacks: true,
    explanation: 'KPRIM generische Erklärung, warum diese Frage richtig ist.',
    choices: [
      {
        correct: true,
        feedback: 'Diese Aussage ist korrekt.',
        value:
          'HML- oder SMB-Faktoren messen möglicherweise Risiken, welche durch konjunkturelle Zyklen entstehen.',
      },
      {
        correct: true,
        feedback: 'Diese Aussage ist korrekt.',
        value:
          'Im Fama-French-Modell wird die Marktrisikoprämie um zwei weitere Faktoren, dem SMB-Faktor und dem HML-Faktor, ergänzt.',
      },
      {
        feedback:
          'Diese Aussage ist falsch. Das Carhart-Modell ist ein Vier-Faktoren-Modell. Zu den Fama-French Faktoren wird noch der Momentum-Faktor hinzugeführt.',
        value:
          'Das Carhart-Modell führt anstelle der Fama-French Faktoren den Momentum-Faktor hinzu.',
      },
      {
        correct: true,
        feedback: 'Diese Aussage ist korrekt.',
        value:
          'Zusätzliche Sensitivitätsfaktoren erklären die Schwankung der Aktienrenditen besser.',
      },
    ],
  },
  {
    id: 4,
    name: 'Modul 4 Business Cycle I',
    content:
      'Aktien von Unternehmen aus zyklischen Industriezweigen haben tendenziell Beta-Werte...',
    type: QuestionType.SC,
    hasSampleSolution: true,
    hasAnswerFeedbacks: true,
    pointsMultiplier: 2,
    explanation: 'SC generische Erklärung, warum diese Frage richtig ist.',
    choices: [
      {
        feedback: 'Falsch!',
        value: '... zwischen 0.0 und 1.0.',
      },
      {
        feedback: 'Falsch!',
        value: '... von etwa 0.0',
      },
      {
        feedback: 'Falsch!',
        value: '... von etwa 1.0.',
      },
      {
        feedback:
          'Korrekt! Aktien aus zyklischen Industrien sind tendenziell volatiler als der Gesamtmarkt und besitzen dementsprechend einen Betawert über 1.0.',
        correct: true,
        value: '... über 1.0.',
      },
      {
        feedback: 'Falsch!',
        value: 'Keine der genannten Aussagen ist richtig.',
      },
    ],
  },
]

export const LEARNING_ELEMENTS = [
  {
    id: '4968ad33-c15c-4b24-9e1f-c31f2d5578f1',
    name: 'Test Lernelement',
    displayName: 'Test Lernelement',
    description: 'Welcome to this **learning element**.',
    orderType: OrderType.SHUFFLED,
    stacks: [
      {
        displayName: 'Stack 1',
        description: 'Description for stack 1',
        elements: [0, 1],
      },
      { elements: [2, 'Text in between elements', 3] },
      {
        displayName: 'Name for stack with only one md element',
        description: 'Description for stack with only one md element',
        elements: ['Pure Text block - could also be Intro'],
      },
      {
        displayName: 'Name for stack with only one question element',
        description: 'Description for stack with only one question element',
        elements: [4],
      },
      { elements: ['Text block 1', 'Text block 2, following text block 1'] },
    ],
  },
  {
    id: '011b1f9e-1b45-4447-8b88-b76fce089389',
    name: 'Test Lernelement x2',
    displayName: 'Test Lernelement x2',
    description: `
Welcome to this **learning element**.
This learning element yields 2x the points.
And it can be done everyday!
`,
    pointsMultiplier: 2,
    resetTimeDays: 1,
    orderType: OrderType.LAST_RESPONSE,
    stacks: [
      {
        displayName: 'Stack 1',
        description: 'Description for stack 1',
        elements: [0],
      },
      { elements: [1] },
      { elements: [2] },
      { elements: [3] },
      { elements: [4] },
    ],
  },
]

export const SESSIONS = [
  {
    id: '1ec093e0-b6b6-421f-98ac-98ab146505f7',
    name: 'Test mit Multiplier',
    displayName: 'Test mit Multiplier',
    isGamificationEnabled: true,
    pointsMultiplier: 2,
    blocks: [
      {
        questions: [2, 4],
      },
      {
        questions: [4, 2],
      },
    ],
  },
  {
    id: '35aad5d9-285d-4dda-9e19-7507ee16e9e1',
    name: 'Test Session',
    displayName: 'Test Session',
    isModerationEnabled: false,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    status: SessionStatus.PREPARED,
    blocks: [
      {
        questions: [0, 1, 2, 3, 4],
      },
      {
        questions: [0, 1, 2, 3, 4],
      },
    ],
  },
  {
    id: '20325ec6-0ce7-4e24-bd79-5c1a46f64c47',
    name: 'Test Session 2',
    displayName: 'Test Session 2',
    isModerationEnabled: false,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    status: SessionStatus.PREPARED,
    blocks: [
      {
        questions: [0, 1, 2, 3, 4],
      },
      {
        questions: [0, 1, 2, 3, 4],
      },
    ],
  },
  {
    id: '166608f3-10b6-4e62-9842-ab8b774fae58',
    name: 'Test Session 3',
    displayName: 'Test Session 3',
    isModerationEnabled: false,
    isLiveQAEnabled: true,
    isConfusionFeedbackEnabled: true,
    isGamificationEnabled: true,
    status: SessionStatus.PREPARED,
    blocks: [
      {
        questions: [4],
        timeLimit: 30,
      },
      {
        questions: [4],
        timeLimit: 30,
      },
      {
        questions: [4],
        timeLimit: 30,
      },
      {
        questions: [4],
        timeLimit: 30,
      },
      {
        questions: [4],
        timeLimit: 30,
      },
    ],
  },
]

export const MICRO_SESSIONS = [
  {
    id: '943b5a26-7bfb-4678-a482-28430afebe3c',
    name: 'Test Micro',
    displayName: 'Test Micro',
    scheduledStartAt: new Date('2022-09-12T20:00:00.000Z'),
    scheduledEndAt: new Date('2023-09-19:12:00.000Z'),
    description: `
Diese Woche lernen wir...

![Alt text](https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.webp)

Mehr bla bla...
`,
    questions: [0, 1, 2, 3, 4],
  },
]
