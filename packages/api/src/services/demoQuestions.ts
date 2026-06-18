import {
  ElementInstanceType,
  ElementType,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'

export async function seedDemoQuestions({
  prisma,
  userId,
}: {
  prisma: PrismaClient
  userId: string
}) {
  const questionSC = await prisma.element.create({
    data: {
      name: 'Demoquestion SC',
      type: ElementType.SC,
      content:
        'Which of the following statements is applicable to _KlickerUZH_?',
      options: {
        displayMode: DisplayMode.GRID,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          {
            ix: 0,
            value: 'KlickerUZH is owned by Google',
            correct: false,
            feedback: 'False!',
          },
          {
            ix: 1,
            value: 'KlickerUZH is an open-source audience response system',
            correct: true,
            feedback: 'Correct! The source code is available on GitHub.',
          },
          {
            ix: 2,
            value: 'KlickerUZH cannot be used by everyone',
            correct: false,
            feedback: 'False!',
          },
          {
            ix: 3,
            value: 'KlickerUZH is not a project of the University of Zurich',
            correct: false,
            feedback: 'False!',
          },
        ],
      },
      explanation:
        'For Single Choice questions, you can specify a correct solution, answer feedbacks and a general explanation. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 1,
      owner: { connect: { id: userId } },
      tags: {
        connectOrCreate: {
          where: {
            ownerId_name: {
              ownerId: userId,
              name: 'Demo Tag',
            },
          },
          create: {
            name: 'Demo Tag',
            owner: { connect: { id: userId } },
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionSC.id, userId },
    prisma
  )

  const questionMC = await prisma.element.create({
    data: {
      name: 'Demoquestion MC',
      type: ElementType.MC,
      content:
        'Which of the following formulas have the form of a Taylor polynomial of some degree $$n$$: $$T_n f(x;a)$$? (multiple answers are possible)',
      options: {
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          {
            ix: 0,
            correct: false,
            value:
              '$$T_n f(x;a) = \\sum_{|\\alpha| = 0}^{n} (x - a)^\\alpha D^\\alpha f(a-x)$$',
            feedback: 'False!',
          },
          {
            ix: 1,
            correct: true,
            value:
              "$$T_n f(x;a) = f(a) + \\frac{f'(a)}{1!}(x - a) + \\frac{f''(a)}{2!}(x - a)^2 + ... + \\frac{f^{(n)}(a)}{n!}(x - a)^n$$",
            feedback:
              'Correct! This is the general form of a Taylor polynomial of degree $$n$$.',
          },
          {
            ix: 2,
            correct: true,
            value: '$$T_4 sin(x;0) = x - \\frac{x^3}{6}$$',
            feedback:
              'Correct! This is the Taylor polynomial of degree $$4$$ of $$sin(x)$$ around $$x = 0$$.',
          },
          {
            ix: 3,
            correct: false,
            value: '$$T_4 cos(x;0) = x + \\frac{x^3}{6}$$',
            feedback: 'False! This is not a Taylor polynomial of $$cos(x)$$.',
          },
        ],
      },
      explanation:
        'Multiple Choice questions can have multiple correct answers. You can specify answer feedbacks and a general explanation. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 2,
      owner: { connect: { id: userId } },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: userId,
            name: 'Demo Tag',
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionMC.id, userId },
    prisma
  )

  const questionKPRIM = await prisma.element.create({
    data: {
      name: 'Demoquestion KPRIM',
      type: ElementType.KPRIM,
      content:
        'Which of the following statements is applicable to _KlickerUZH_? (multiple correct answers possible)',
      options: {
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          {
            ix: 0,
            value: 'KlickerUZH is owned by Google',
            correct: false,
            feedback: 'False!',
          },
          {
            ix: 1,
            value: 'KlickerUZH is an open-source audience response system',
            correct: true,
            feedback: 'Correct! The source code is available on GitHub.',
          },
          {
            ix: 2,
            value: 'KlickerUZH cannot be used by everyone',
            correct: false,
            feedback: 'False!',
          },
          {
            ix: 3,
            value:
              'KlickerUZH can be used in lecture settings with serveral hundred students',
            correct: true,
            feedback:
              'Correct! KlickerUZH is designed for large audiences and can handle thousands of concurrent users.',
          },
        ],
      },
      explanation:
        'KPRIM questions differ from Multiple Choice questions in that they use a different grading approach and consist of exactly four answer possibilities, which have to be selected to be true or false. You can specify answer feedbacks and a general explanation. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 3,
      owner: { connect: { id: userId } },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: userId,
            name: 'Demo Tag',
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionKPRIM.id, userId },
    prisma
  )

  const questionNR = await prisma.element.create({
    data: {
      name: 'Demoquestion NR',
      type: ElementType.NUMERICAL,
      content:
        'Estimate the length of the **longest** river in the world (answer in kilometres).',
      options: {
        hasSampleSolution: true,
        unit: 'km',
        accuracy: 0,
        restrictions: { max: 10000, min: 0 },
        solutionRanges: [{ max: 6600, min: 6500 }],
      },
      explanation:
        'Numerical questions can contain additional restrictions, like minimum and maximum values as well as display units. It is also possible to specify valid ranges, which are considered to be correct for graded and gamified settings, as well as a general explanation. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 4,
      owner: { connect: { id: userId } },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: userId,
            name: 'Demo Tag',
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionNR.id, userId },
    prisma
  )

  const questionFT = await prisma.element.create({
    data: {
      name: 'Demoquestion FT',
      type: ElementType.FREE_TEXT,
      content: 'Describe a main principle of a social market economy.',
      options: {
        displayMode: DisplayMode.LIST,
        hasSampleSolution: true,
        solutions: ['fair competition', 'private companies', 'balance'],
        restrictions: { maxLength: 150 },
      },
      explanation:
        'Free Text questions can contain additional restrictions, like a maximum length, as well as sample solutions for graded and gamified settings. All of those texts can be formatted using the editor or Markdown and LaTeX syntax and can contain images.',
      pointsMultiplier: 4,
      owner: { connect: { id: userId } },
      tags: {
        connect: {
          ownerId_name: {
            ownerId: userId,
            name: 'Demo Tag',
          },
        },
      },
    },
  })
  await recomputeDerivedPermissions(
    { elementId: questionFT.id, userId },
    prisma
  )

  const flashcard = await prisma.element.create({
    data: {
      name: 'Demo Flashcard',
      type: ElementType.FLASHCARD,
      content: 'What is the main use case for Flashcards?',
      options: {},
      explanation:
        'Flashcards are a great way to learn educational content by heart. Both sides of the flashcard fully support LaTeX and Markdown syntax, as well as images.',
      pointsMultiplier: 1,
      owner: { connect: { id: userId } },
      tags: {
        connect: { ownerId_name: { ownerId: userId, name: 'Demo Tag' } },
      },
      basePoints: false,
    },
  })
  await recomputeDerivedPermissions({ elementId: flashcard.id, userId }, prisma)

  const contentElement = await prisma.element.create({
    data: {
      name: 'Demo Content Element',
      type: ElementType.CONTENT,
      content:
        'Content elements are a great way to provide additional information to your students. They fully support LaTeX and Markdown syntax and allow to include images. You can also use them to recap relevant course content in asynchronous KlickerUZH elements before asking a series of questions.',
      options: {},
      owner: { connect: { id: userId } },
      tags: {
        connect: { ownerId_name: { ownerId: userId, name: 'Demo Tag' } },
      },
      basePoints: false,
    },
  })
  await recomputeDerivedPermissions(
    { elementId: contentElement.id, userId },
    prisma
  )

  const blockData = [
    {
      questions: [questionSC, questionMC],
      timeLimit: 100,
      randomSelection: null,
    },
    {
      questions: [questionKPRIM, questionNR, questionFT],
      timeLimit: null,
      randomSelection: null,
    },
    {
      questions: [questionSC],
      timeLimit: 50,
      randomSelection: null,
    },
    {
      questions: [questionMC],
      timeLimit: 20,
      randomSelection: null,
    },
    {
      questions: [questionKPRIM],
      timeLimit: null,
      randomSelection: null,
    },
  ]

  const quizMultiplier = 2
  const liveQuiz = await prisma.liveQuiz.create({
    data: {
      name: 'Demo Live Quiz',
      displayName: 'Demo Live Quiz Display Name',
      description: 'Demo Live Quiz Description',
      pointsMultiplier: quizMultiplier,
      isGamificationEnabled: true,
      blocks: {
        create: blockData.map(
          ({ questions, randomSelection, timeLimit }, blockIx) => ({
            order: blockIx,
            timeLimit,
            randomSelection,
            elements: {
              create: questions.map((element, elementIx) => {
                const elementData = processElementData(element)
                const initialResults = getInitialInstanceResults(elementData)

                return {
                  order: elementIx,
                  type: ElementInstanceType.LIVE_QUIZ,
                  elementType: element.type,
                  elementData,
                  options: {
                    pointsMultiplier: quizMultiplier * element.pointsMultiplier,
                    basePoints: element.basePoints,
                  },
                  results: initialResults,
                  anonymousResults: initialResults,
                  instanceStatistics: {
                    create: getInitialInstanceStatistics(
                      ElementInstanceType.LIVE_QUIZ
                    ),
                  },
                  element: { connect: { id: element.id } },
                  owner: { connect: { id: userId } },
                }
              }),
            },
          })
        ),
      },
      owner: {
        connect: { id: userId },
      },
    },
    include: {
      blocks: true,
    },
  })
  await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id, userId }, prisma)
}
