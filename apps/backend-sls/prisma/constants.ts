import * as Prisma from '@klicker-uzh/prisma'

export const PARTICIPANT_IDS = [
  '6f45065c-667f-4259-818c-c6f6b477eb48',
  '0b7c946c-cfc9-4b82-ac97-b058bf48924b',
  '52c20f0f-f5d4-4354-a5d6-a0c103f2b9ea',
  '16c39a69-03b4-4ce4-a695-e7b93d535598',
  'c48f624e-7de9-4e1b-a16d-82d22e64828f',
  '7cf9a94a-31a6-4c53-85d7-608dfa904e30',
  'f53e6a95-689b-48c0-bfab-6625c04f39ed',
  '46407010-0e7c-4903-9a66-2c8d9d6909b0',
  '84b0ba5d-34bc-45cd-8253-f3e8c340e5ff',
  '05a933a0-b2bc-4551-b7e1-6975140d996d',
]

export const ATTACHMENTS = [
  {
    id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0b',
    href: 'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.svg',
    name: 'Test Attachment 1',
    type: Prisma.AttachmentType.SVG,
  },
  {
    id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0c',
    href: 'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.webp',
    name: 'Test Attachment 2',
    type: Prisma.AttachmentType.WEBP,
  },
]

export const QUESTIONS = [
  {
    id: 5,
    name: 'Numerische Testfrage',
    content: 'Was ist richtig?',
    contentPlain: 'Was ist richtig?',
    type: Prisma.QuestionType.NUMERICAL,
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
    type: Prisma.QuestionType.FREE_TEXT,
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
    name: 'Soziale Marktwirtschaft',
    content: 'Beschreibe die Hauptprinzipien einer sozialen Marktwirtschaft.',
    contentPlain:
      'Beschreibe die Hauptprinzipien einer sozialen Marktwirtschaft.',
    type: Prisma.QuestionType.FREE_TEXT,
    options: {
      restrictions: {
        maxLength: 100,
      },
      solutions: [
        'Freie Marktwirtschaft mit Ausgleichsfunktionen',
        'Beispiele sind die meisten Länder in Europa',
      ],
    },
  },
  {
    id: 9,
    name: 'Zieldreieck',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: Prisma.QuestionType.SC,
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
    questions: [0, 1, 2, 3, 4],
  },
]

export const SESSIONS = [
  {
    id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
    name: 'BF1 VL1',
    displayName: 'Banking und Finance I - VL1',
    status: Prisma.SessionStatus.PREPARED,
    blocks: [{ questions: [6, 7, 8] }, { questions: [9, 10, 11] }],
  },
  {
    id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c09',
    name: 'BF1 VL2',
    displayName: 'Banking und Finance I - VL2',
    isModerationEnabled: false,
    isAudienceInteractionActive: true,
    isGamificationEnabled: true,
    status: Prisma.SessionStatus.PREPARED,
    blocks: [
      {
        questions: [6, 7, 8],
        expiresAt: new Date('2022-12-31T23:59:59.999Z'),
        timeLimit: 20,
      },
      {
        questions: [9, 10, 11],
        expiresAt: new Date('2022-12-31T23:59:59.999Z'),
        timeLimit: 30,
      },
    ],
  },
  {
    id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c0a',
    name: 'BF1 VL3',
    displayName: 'Banking und Finance I - VL3',
    isModerationEnabled: false,
    isAudienceInteractionActive: true,
    isGamificationEnabled: true,
    status: Prisma.SessionStatus.PREPARED,
    blocks: [
      {
        questions: [12, 7],
        expiresAt: new Date('2022-12-31T23:59:59.999Z'),
        timeLimit: 20,
      },
      {
        questions: [3, 4],
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
    questions: [1, 4, 6, 3],
  },
]
