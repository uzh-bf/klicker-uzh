import Prisma from '../../../dist'
import { AchievementType } from '../../client'
const { ElementType, SessionStatus } = Prisma

export const QUESTIONS = [
  {
    originalId: '0',
    name: 'Testfrage FREE_TEXT',
    content:
      'Beantworte mich korrekt, richtig, oder genau. Ansonsten bekommst du keine Punkte!',
    explanation: 'FT generische Erklärung, warum diese Frage richtig ist.',
    type: ElementType.FREE_TEXT,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: false,
      restrictions: {
        maxLength: 100,
      },
      solutions: ['korrekt', 'richtig', 'genau'],
    },
  },
  {
    originalId: '1',
    name: 'Testfrage MC',
    content: 'Wähle 2 und 3, denn sonst ist es vorbei.',
    explanation: 'MC generische Erklärung, warum diese Frage richtig ist.',
    type: ElementType.MC,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      displayMode: 'LIST',
    },
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
    originalId: '2',
    name: 'Testfrage NUMERICAL',
    content: 'Wie viel würdest du in Aktien anlegen? Beni mag 17%.',
    explanation: 'NR generische Erklärung, warum diese Frage richtig ist.',
    type: ElementType.NUMERICAL,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: false,
      accuracy: 2,
      unit: '%',
      restrictions: {
        min: -10,
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
    originalId: '3',
    name: 'Multi-Faktor-Modell',
    content: 'Welche Aussagen zum Multi-Faktor-Modell sind korrekt?',
    type: ElementType.KPRIM,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      displayMode: 'LIST',
    },
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
    originalId: '4',
    name: 'Modul 4 Business Cycle I',
    content:
      'Aktien von Unternehmen aus zyklischen Industriezweigen haben tendenziell Beta-Werte...',
    type: ElementType.SC,
    pointsMultiplier: 2,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      displayMode: 'LIST',
    },
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
        timeLimit: undefined,
      },
      {
        questions: [4, 2],
        timeLimit: undefined,
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
        timeLimit: undefined,
      },
      {
        questions: [0, 1, 2, 3, 4],
        timeLimit: undefined,
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
        timeLimit: undefined,
      },
      {
        questions: [0, 1, 2, 3, 4],
        timeLimit: 30,
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
    arePushNotificationsSent: false,
    description: `
Diese Woche lernen wir...

Mehr bla bla...
`,
    questions: [0, 1, 2, 3, 4],
  },
]

export enum AchievementIds {
  Explorer = 2,
  'Busy Bee' = 3,
  Champion = 5,
  'Vice-Champion' = 6,
  'Vice-Vice-Champion' = 7,
  'Dream Team' = 8,
  'Team Spirit' = 9,
  'Fearless' = 10,
  'Creative Mastermind' = 11,
  Entertainer = 12,
  'Future Proof' = 13,
  Happiness = 14,
  'Presentation Wizard' = 15,
  'Shooting Star' = 16,
  Speedy = 17,
}

// import the questions from below and add them to the array
export const Achievements: {
  id: number
  nameDE: string
  nameEN: string
  descriptionDE: string
  descriptionEN: string
  icon: string
  type: AchievementType
  rewardedPoints?: number
  rewardedXP?: number
}[] = [
  // pilot achievement
  {
    id: AchievementIds.Explorer,
    nameDE: 'Explorer',
    nameEN: 'Explorer',
    descriptionDE:
      'Du warst Teil des KlickerUZH im ersten Semester. Dankeschön!',
    descriptionEN:
      'You were part of KlickerUZH in the first semester. Thank you!',
    icon: '/achievements/Erkunden.svg',
    type: 'PARTICIPANT',
  },
  // solved everything achievement
  {
    id: AchievementIds['Busy Bee'],
    nameDE: 'Busy Bee',
    nameEN: 'Busy Bee',
    descriptionDE:
      'Du hast alle verfügbaren Microlearnings und Übungs-Quizzes gelöst.',
    descriptionEN:
      'You have solved all available microlearnings and practice quizzes.',
    icon: '/achievements/Fleisspreis.svg',
    type: 'PARTICIPANT',
  },
  // gold medal achievement
  {
    id: AchievementIds.Champion,
    nameDE: 'Champion',
    nameEN: 'Champion',
    descriptionDE: 'Du hast einen ersten Platz in einer Live Quiz erreicht.',
    descriptionEN: 'You have reached first place in a live quiz.',
    icon: '/achievements/Champ.svg',
    rewardedPoints: 100,
    rewardedXP: 200,
    type: 'PARTICIPANT',
  },
  // silver medal achievement
  {
    id: AchievementIds['Vice-Champion'],
    nameDE: 'Vize-Champion',
    nameEN: 'Vice-Champion',
    descriptionDE: 'Du hast einen zweiten Platz in einer Live Quiz erreicht.',
    descriptionEN: 'You have reached second place in a live quiz.',
    icon: '/achievements/VizeChamp.svg',
    rewardedPoints: 50,
    rewardedXP: 100,
    type: 'PARTICIPANT',
  },
  // bronze medal achievement
  {
    id: AchievementIds['Vice-Vice-Champion'],
    nameDE: 'Vize-Vize-Champion',
    nameEN: 'Vice-Vice-Champion',
    descriptionDE: 'Du hast einen dritten Platz in einer Live Quiz erreicht.',
    descriptionEN: 'You have reached third place in a live quiz.',
    icon: '/achievements/VizevizeChamp.svg',
    rewardedPoints: 25,
    rewardedXP: 50,
    type: 'PARTICIPANT',
  },
  // TODO: re-introduce this price
  // last place achievement
  // {
  //   id: 4,
  //   nameDE: 'Trostpreis',
  //   nameEN: 'Consolation Prize',
  //   descriptionDE: 'Dabei sein ist alles (letzer Platz in einer Live Quiz).',
  //   descriptionEN: 'Being there is everything (last place in a live quiz).',
  //   icon: '/achievements/Trostpreis.svg',
  //   type: 'PARTICIPANT',
  // },
  // group task passed achievement
  {
    id: AchievementIds['Dream Team'],
    nameDE: 'Dream Team',
    nameEN: 'Dream Team',
    descriptionDE:
      'Du hast im Gruppentask über die Hälfte der Punkte erreicht.',
    descriptionEN:
      'You have reached more than half of the points in the group task.',
    icon: '/achievements/Dreamteam.svg',
    rewardedPoints: 500,
    rewardedXP: 500,
    type: 'PARTICIPANT',
  },
  // group task done achievement
  {
    id: AchievementIds['Team Spirit'],
    nameDE: 'Teamgeist',
    nameEN: 'Team Spirit',
    descriptionDE: 'Du hast einen Gruppentask absolviert.',
    descriptionEN: 'You have completed a group task.',
    icon: '/achievements/Teamgeist.svg',
    rewardedPoints: 0,
    rewardedXP: 100,
    type: 'PARTICIPANT',
  },
  // few questions achievement
  {
    id: AchievementIds.Fearless,
    nameDE: 'Unerschrocken',
    nameEN: 'Fearless',
    descriptionDE:
      'Du hast eine Woche vor Ende der Vorlesung noch keine 6 Fragen beantwortet.',
    descriptionEN:
      'You have not answered 6 questions yet one week before the end of the lecture.',
    icon: '/achievements/Unerschrocken.svg',
    type: 'PARTICIPANT',
  },
  // creative achievement
  {
    id: AchievementIds['Creative Mastermind'],
    nameDE: 'Creative Mastermind',
    nameEN: 'Creative Mastermind',
    descriptionDE: 'Du hast ein eigenes Übungs-Quizzes erstellt.',
    descriptionEN: 'You have created your own practice quiz.',
    icon: '/achievements/CreativeMastermind.svg',
    type: 'PARTICIPANT',
  },
  // entertainer achievement
  {
    id: AchievementIds.Entertainer,
    nameDE: 'Entertainer',
    nameEN: 'Entertainer',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/Entertainer.svg',
    type: 'PARTICIPANT',
  },
  // future proof achievement
  {
    id: AchievementIds['Future Proof'],
    nameDE: 'Future Proof',
    nameEN: 'Future Proof',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/FutureProof.svg',
    type: 'PARTICIPANT',
  },
  // happiness achievement
  {
    id: AchievementIds.Happiness,
    nameDE: 'Happiness',
    nameEN: 'Happiness',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/Happiness.svg',
    type: 'PARTICIPANT',
  },
  // presentation achievement
  {
    id: AchievementIds['Presentation Wizard'],
    nameDE: 'Presentation Wizard',
    nameEN: 'Presentation Wizard',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/PresentationWizard.svg',
    type: 'PARTICIPANT',
  },
  // shooting star achievement
  {
    id: AchievementIds['Shooting Star'],
    nameDE: 'Shooting Star',
    nameEN: 'Shooting Star',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/Shootingstar.svg',
    type: 'PARTICIPANT',
  },
  // speedy achievement
  {
    id: AchievementIds.Speedy,
    nameDE: 'Speedy',
    nameEN: 'Speedy',
    descriptionDE: '',
    descriptionEN: '',
    icon: '/achievements/Speedy.svg',
    type: 'PARTICIPANT',
  },
]
