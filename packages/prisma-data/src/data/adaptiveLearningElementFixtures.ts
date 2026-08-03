import * as Prisma from '@klicker-uzh/prisma/client'

export function adaptiveElementContent({
  competenceName,
  subCompetenceName,
  levelLabel,
  itemIndex,
  type,
}: {
  competenceName: string
  subCompetenceName: string
  levelLabel: string
  itemIndex: number
  type: Prisma.ElementType
}) {
  const task = adaptiveEnglishTask({
    competenceName,
    subCompetenceName,
    levelLabel,
    itemIndex,
  })
  const responseInstruction =
    type === Prisma.ElementType.SC
      ? 'Choose the best answer.'
      : type === Prisma.ElementType.MC
        ? 'Select all answers that are appropriate.'
        : type === Prisma.ElementType.KPRIM
          ? 'Mark each statement that is true.'
          : 'Write the requested word or short phrase.'

  return `## ${competenceName} - ${subCompetenceName} (${levelLabel})

${task}

${responseInstruction}`
}

function adaptiveEnglishTask({
  competenceName,
  subCompetenceName,
  levelLabel,
  itemIndex,
}: {
  competenceName: string
  subCompetenceName: string
  levelLabel: string
  itemIndex: number
}) {
  if (competenceName === 'Reading') {
    const text = cefrReadingText(levelLabel, subCompetenceName)
    return `Read the text.

> ${text}

Question ${itemIndex + 1}: What does the task mainly test in this text?`
  }

  if (competenceName === 'Writing') {
    return `Improve this ${levelLabel} learner sentence for ${subCompetenceName.toLowerCase()}:

> ${cefrWritingSentence(levelLabel, subCompetenceName)}

Question ${itemIndex + 1}: Which response best improves the writing?`
  }

  return `Complete or judge the sentence for ${subCompetenceName.toLowerCase()}:

> ${cefrGrammarSentence(levelLabel, subCompetenceName)}

Question ${itemIndex + 1}: Which form is grammatically appropriate?`
}

export function adaptiveElementExplanation({
  competenceName,
  subCompetenceName,
  levelLabel,
}: {
  competenceName: string
  subCompetenceName: string
  levelLabel: string
}) {
  return `${levelLabel} ${competenceName.toLowerCase()} item focused on ${subCompetenceName.toLowerCase()}. The correct answer matches the CEFR-aligned language feature described in the prompt.`
}

export function adaptiveSeedChoices({
  type,
  competenceName,
  subCompetenceName,
  levelLabel,
}: {
  type: Prisma.ElementType
  competenceName: string
  subCompetenceName: string
  levelLabel: string
}) {
  if (type === Prisma.ElementType.FREE_TEXT) return undefined

  if (type === Prisma.ElementType.MC) {
    return [
      {
        value: adaptiveCorrectChoice(competenceName, subCompetenceName),
        correct: true,
        feedback: 'Correct.',
      },
      {
        value: adaptiveDistractorChoice(competenceName, levelLabel, 0),
        feedback: 'This answer does not match the prompt closely enough.',
      },
      {
        value: adaptiveSecondCorrectChoice(competenceName, subCompetenceName),
        correct: true,
        feedback: 'Correct.',
      },
      {
        value: adaptiveDistractorChoice(competenceName, levelLabel, 1),
        feedback: 'This choice changes the meaning or register.',
      },
    ]
  }

  if (type === Prisma.ElementType.KPRIM) {
    return [
      {
        value: adaptiveCorrectChoice(competenceName, subCompetenceName),
        correct: true,
        feedback: 'True.',
      },
      {
        value: adaptiveDistractorChoice(competenceName, levelLabel, 0),
        feedback: 'False.',
      },
      {
        value: adaptiveSecondCorrectChoice(competenceName, subCompetenceName),
        correct: true,
        feedback: 'True.',
      },
      {
        value: adaptiveDistractorChoice(competenceName, levelLabel, 1),
        feedback: 'False.',
      },
    ]
  }

  return [
    {
      value: adaptiveCorrectChoice(competenceName, subCompetenceName),
      correct: true,
      feedback: 'Correct.',
    },
    {
      value: adaptiveDistractorChoice(competenceName, levelLabel, 0),
      feedback: 'This answer does not fit the task.',
    },
    {
      value: adaptiveDistractorChoice(competenceName, levelLabel, 1),
      feedback: 'This answer is too vague or inaccurate.',
    },
    {
      value: adaptiveDistractorChoice(competenceName, levelLabel, 2),
      feedback: 'This changes the intended meaning.',
    },
  ]
}

export function adaptiveSeedOptions(type: Prisma.ElementType) {
  if (type === Prisma.ElementType.FREE_TEXT) {
    return {
      hasSampleSolution: true,
      restrictions: { maxLength: 160 },
      solutions: ['because', 'however', 'clear conclusion', 'main idea'],
    }
  }

  return {
    hasSampleSolution: true,
    hasAnswerFeedbacks: true,
    displayMode: 'LIST',
  }
}

function cefrReadingText(levelLabel: string, subCompetenceName: string) {
  const texts: Record<string, string> = {
    A1: 'Mia is at the station. Her train leaves at nine. She buys a ticket and waits near platform two.',
    A2: 'The college library closes early on Friday because the staff are preparing a weekend exhibition for new students.',
    B1: 'Although the online course was convenient, Karim missed the informal discussions that helped him test his ideas.',
    B2: 'The article argues that remote work can improve concentration, but only when teams deliberately protect informal communication.',
    C1: "The reviewer praises the author's elegant style while questioning whether the central argument relies too heavily on anecdotal evidence.",
    C2: 'The editorial uses irony to expose a contradiction: institutions celebrate innovation while quietly rewarding only familiar forms of success.',
  }

  return `${texts[levelLabel] ?? texts.B1} Focus: ${subCompetenceName.toLowerCase()}.`
}

function cefrWritingSentence(levelLabel: string, subCompetenceName: string) {
  const sentences: Record<string, string> = {
    A1: 'I go to class every Monday and I like my teacher.',
    A2: 'Yesterday I visited the museum because I wanted to learn about local history.',
    B1: 'The city should create more bike lanes because they are cheaper and healthier than car traffic.',
    B2: 'While the proposal has clear benefits, it would require careful planning to avoid excluding smaller schools.',
    C1: 'The policy is persuasive insofar as it links funding to evidence, yet its implementation risks widening regional inequality.',
    C2: "What appears to be a minor stylistic choice subtly reframes the reader's moral judgement of the narrator.",
  }

  return `${sentences[levelLabel] ?? sentences.B1} Focus: ${subCompetenceName.toLowerCase()}.`
}

function cefrGrammarSentence(levelLabel: string, subCompetenceName: string) {
  const sentences: Record<string, string> = {
    A1: 'She ___ from Zurich and studies English in the morning.',
    A2: 'We ___ dinner when the phone rang.',
    B1: 'If I had more time, I ___ a longer report.',
    B2: 'The article, ___ was published last week, has already been widely discussed.',
    C1: 'Had the committee consulted students earlier, the transition ___ smoother.',
    C2: 'Rarely ___ such a concise explanation changed the direction of a complex debate.',
  }

  return `${sentences[levelLabel] ?? sentences.B1} Focus: ${subCompetenceName.toLowerCase()}.`
}

function adaptiveCorrectChoice(
  competenceName: string,
  subCompetenceName: string
) {
  if (competenceName === 'Reading') {
    return `It identifies the relevant ${subCompetenceName.toLowerCase()} evidence in the text.`
  }
  if (competenceName === 'Writing') {
    return `It improves ${subCompetenceName.toLowerCase()} while keeping the meaning clear.`
  }
  return `It uses the correct form for ${subCompetenceName.toLowerCase()}.`
}

function adaptiveSecondCorrectChoice(
  competenceName: string,
  subCompetenceName: string
) {
  if (competenceName === 'Reading') {
    return `It keeps the answer grounded in the wording of the passage.`
  }
  if (competenceName === 'Writing') {
    return `It matches the expected register and links ideas logically.`
  }
  return `It fits both the grammar pattern and the sentence meaning.`
}

function adaptiveDistractorChoice(
  competenceName: string,
  levelLabel: string,
  index: number
) {
  const distractors = {
    Reading: [
      `It adds information that is not stated in the ${levelLabel} text.`,
      'It focuses on a minor word and misses the main point.',
      'It contradicts the passage.',
    ],
    Writing: [
      `It makes the ${levelLabel} sentence less precise.`,
      'It changes the intended meaning.',
      'It uses a register that does not fit the task.',
    ],
    Grammar: [
      `It uses a form that is too simple for the ${levelLabel} sentence.`,
      'It breaks the agreement or word order.',
      'It does not fit the time reference.',
    ],
  } as const

  return (
    distractors[competenceName as keyof typeof distractors][index] ??
    'It does not answer the question.'
  )
}
