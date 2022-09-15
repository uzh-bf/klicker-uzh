import Prisma from '@klicker-uzh/prisma'
const { AttachmentType, QuestionType, SessionStatus } = Prisma

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
    id: 5,
    name: 'Numerische Testfrage',
    content: 'Was ist richtig?',
    contentPlain: 'Was ist richtig?',
    type: QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 10,
      },
      solutionRanges: [
        {
          min: 0.5,
          max: 0.6,
        },
        {
          min: 2,
        },
        {
          max: 4,
        },
        {
          min: 5,
        },
        {
          max: 5,
        },
      ],
    },
  },
  {
    id: 6,
    name: 'Freitext Testfrage',
    content: 'Was ist richtig?',
    contentPlain: 'Was ist richtig?',
    type: QuestionType.FREE_TEXT,
    options: {
      restrictions: {
        maxLength: 200,
      },
      solutions: ['Schweiz', 'CH'],
    },
  },
  {
    id: 7,
    name: 'RDWachstum',
    content:
      'Wie hoch schätzt du das durchschnittliche Wachstum der Forschung- und Entwicklungskosten in den nächsten fünf Jahren?',
    contentPlain:
      'Wie hoch schätzt du das durchschnittliche Wachstum der Forschung- und Entwicklungskosten in den nächsten fünf Jahren?',
    type: Prisma.QuestionType.NUMERICAL,
    options: {
      restrictions: {
        min: 0,
        max: 100,
      },
      solutionRanges: [
        {
          min: 0,
          max: 5,
        },
        {
          min: 95,
          max: 100,
        },
      ],
    },
  },
  {
    id: 8,
    name: 'Bilanz',
    content:
      'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
    contentPlain:
      'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Aktivseite zeigt die Mittelverwendung auf.',
        value: 'Die Aktivseite zeigt die Mittelherkunft auf.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Passivseite zeigt die Mittelherkunft auf.',
        value: 'Die Passivseite der Bilanz zeigt die Mittelverwendung auf.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Das EK zeigt zwar die Mittelherkunft auf, diese wird aber auf der Passivseite der Bilanz abgebildet.',
        value:
          'Das EK zeigt die Mittelherkunft auf und steht somit auf der Aktivseite der Bilanz.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Das Konto Flüssige Mittel zeigt die Mittelverwendung auf und steht somit auf der Aktivseite der Bilanz.',
      },
    ],
  },
  {
    id: 9,
    name: 'Zieldreieck',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        feedback:
          'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
        value:
          'Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
      },
      {
        feedback:
          'Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.',
        correct: true,
        value:
          'Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens.',
      },
      {
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
]

export const LEARNING_ELEMENTS = [
  {
    id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
    name: 'Test Learning Element 1',
    displayName: 'Test Learning Element 1',
    questions: [9, 8],
  },
]

export const SESSIONS = [
  {
    id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
    name: 'BF1 VL1',
    displayName: 'Banking und Finance I - VL1',
    status: SessionStatus.PREPARED,
    blocks: [{ questions: [6, 7, 8] }, { questions: [9, 5] }],
  },
  {
    id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c09',
    name: 'BF1 VL2',
    displayName: 'Banking und Finance I - VL2',
    isModerationEnabled: false,
    isAudienceInteractionActive: true,
    isGamificationEnabled: true,
    status: SessionStatus.PREPARED,
    blocks: [
      {
        questions: [6, 7, 8, 9],
        expiresAt: new Date('2022-12-31T23:59:59.999Z'),
        timeLimit: 20,
      },
      {
        questions: [6, 7, 8, 9],
        expiresAt: new Date('2022-12-31T23:59:59.999Z'),
        timeLimit: 30,
      },
    ],
  },
]

export const MICRO_SESSIONS = [
  {
    id: '0ce58914-efaa-4ee5-9693-db497f7e5d46',
    name: 'BF1 VL1',
    displayName: 'Banking und Finance I - VL1',
    scheduledStartAt: new Date('2022-09-12T20:00:00.000Z'),
    scheduledEndAt: new Date('2022-09-17:00:00.000Z'),
    description: `
Diese Woche lernen wir...

![Alt text](https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.webp)

Mehr bla bla...
`,
    questions: [9, 8],
  },
]
