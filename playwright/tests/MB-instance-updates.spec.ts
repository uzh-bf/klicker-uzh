import { Page } from '@playwright/test'
import dmQuestionsData from '../fixtures/DM-questions.json' with { type: 'json' }
import questionsData from '../fixtures/questions.json' with { type: 'json' }
import { cleanupTest } from '../util/cleanup.js'
import { LECTURER_ID } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  createGroupActivity,
  createLiveQuiz,
  createMicroLearning,
  createPracticeQuiz,
} from '../util/fixtures/activities.js'
import {
  createQuestionKPRIM,
  createQuestionMC,
  createQuestionSC,
  searchAndEdit,
  validateElement,
} from '../util/fixtures/elements.js'
import { getDatetimeValidationString } from '../util/helpers.js'

type Choice = {
  value: string
  correct?: boolean
  feedback?: string
}

type MbData = typeof questionsData &
  typeof dmQuestionsData & {
    SCML: {
      title: string
      content: string
      choices: Choice[]
    }
    MCML: {
      title: string
      content: string
      choices: Choice[]
    }
    KPML: {
      title: string
      content: string
      choices: Choice[]
    }
    instanceUpdates: {
      courseName: string
      liveQuizName: string
      practiceQuizName: string
      microlearningName: string
      groupActivityName: string
      newSCTitle: string
      newMCTitle: string
    }
  }

type ActivityType =
  | 'LIVE_QUIZ'
  | 'PRACTICE_QUIZ'
  | 'MICRO_LEARNING'
  | 'GROUP_ACTIVITY'

const data = { ...questionsData, ...dmQuestionsData } as MbData

test('CLEANUP', cleanupTest)

function editActivityTestId(type: ActivityType, name: string) {
  if (type === 'LIVE_QUIZ') return `edit-live-quiz-${name}`
  if (type === 'PRACTICE_QUIZ') return `edit-practice-quiz-${name}`
  if (type === 'MICRO_LEARNING') return `edit-microlearning-${name}`
  return `edit-group-activity-${name}`
}

async function saveElementModal(page: Page) {
  await page.getByTestId('save-new-question').click({ force: true })
  await expect(page.getByTestId('insert-question-title')).not.toBeAttached({
    timeout: 30000,
  })
  await page.waitForTimeout(500)
}

async function createChoiceQuestions(page: Page) {
  await createQuestionSC({
    name: data.SCML.title,
    content: data.SCML.content,
    choices: data.SCML.choices,
    userId: LECTURER_ID,
  })
  await page.reload()
  await validateElement(page, data.SCML.title)

  await createQuestionMC({
    name: data.MCML.title,
    content: data.MCML.content,
    choices: data.MCML.choices,
    userId: LECTURER_ID,
  })
  await page.reload()
  await validateElement(page, data.MCML.title)

  await createQuestionKPRIM({
    name: data.KPML.title,
    content: data.KPML.content,
    choices: data.KPML.choices,
    userId: LECTURER_ID,
  })
  await page.reload()
  await validateElement(page, data.KPML.title)
}

async function createAllActivities(page: Page) {
  const elements = [data.SCML.title, data.MCML.title, data.KPML.title]

  await createLiveQuiz(page, {
    name: data.instanceUpdates.liveQuizName,
    displayName: data.instanceUpdates.liveQuizName,
    courseName: data.instanceUpdates.courseName,
    blocks: [{ elements }, { elements }],
  })
  await page.getByTestId('create-new-activity').click()

  await createPracticeQuiz(page, {
    name: data.instanceUpdates.practiceQuizName,
    displayName: data.instanceUpdates.practiceQuizName,
    courseName: data.instanceUpdates.courseName,
    stacks: [{ elements }, { elements }],
  })
  await page.getByTestId('create-new-activity').click()

  await createMicroLearning(page, {
    name: data.instanceUpdates.microlearningName,
    displayName: data.instanceUpdates.microlearningName,
    courseName: data.instanceUpdates.courseName,
    startDate: {
      monthDelta: -2,
      day: 16,
      hour: 2,
      minute: 0,
      validation: `${getDatetimeValidationString(-2, '16')}, 02:00`,
    },
    endDate: {
      monthDelta: 4,
      day: 14,
      hour: 18,
      minute: 0,
      validation: `${getDatetimeValidationString(4, '14')}, 18:00`,
    },
    stacks: [{ elements }, { elements }],
  })
  await page.getByTestId('create-new-activity').click()

  await createGroupActivity(page, {
    name: data.instanceUpdates.groupActivityName,
    displayName: data.instanceUpdates.groupActivityName,
    task: 'Task Description',
    courseName: data.instanceUpdates.courseName,
    scheduledStartDate: {
      monthDelta: -1,
      day: 10,
      hour: 12,
      minute: 30,
      validation: `${getDatetimeValidationString(-1, '10')}, 12:30`,
    },
    scheduledEndDate: {
      monthDelta: 2,
      day: 20,
      hour: 14,
      minute: 0,
      validation: `${getDatetimeValidationString(2, '20')}, 14:00`,
    },
    clues: [
      {
        type: 'text',
        name: 'Clue 1',
        displayName: 'First Hint',
        content: 'Lorem ipsum dolor sit amet',
      },
      {
        type: 'text',
        name: 'Clue 2',
        displayName: 'Second Hint',
        content: 'Consectetur adipiscing elit',
      },
    ],
    stack: {
      elements: [
        data.SCML.title,
        data.MCML.title,
        data.KPML.title,
        data.SCML.title,
        data.MCML.title,
        data.KPML.title,
      ],
    },
  })
  await page.getByTestId('create-new-activity').click()
}

async function expectActivityDetails(
  page: Page,
  {
    type,
    name,
    stacks,
    outdated,
  }: {
    type: ActivityType
    name: string
    stacks: string[][]
    outdated: boolean
  }
) {
  await expect(page.getByTestId(`activity-${type}-${name}`)).toBeAttached()
  const outdatedHint = page.getByTestId(`instances-outdated-${name}`)
  if (outdated) {
    await expect(outdatedHint).toBeAttached()
  } else {
    await expect(outdatedHint).not.toBeAttached()
  }

  await page.getByTestId(`activity-name-${name}`).click()
  for (let stackIx = 0; stackIx < stacks.length; stackIx++) {
    for (let elementIx = 0; elementIx < stacks[stackIx].length; elementIx++) {
      await expect(
        page.getByTestId(`stack-${stackIx}-instance-${elementIx}`)
      ).toContainText(stacks[stackIx][elementIx])
    }
  }
  await page.getByTestId('close-activity-details-modal').click()
}

async function openActivityEditView(
  page: Page,
  {
    type,
    name,
    outdated,
  }: {
    type: ActivityType
    name: string
    outdated: boolean
  }
) {
  await page.getByTestId('activities').click()
  await page.getByTestId(`actions-${type}-${name}`).click()

  const outdatedHint = page.getByTestId(`instances-outdated-${name}`)
  if (outdated) {
    await expect(outdatedHint).toBeAttached()
  } else {
    await expect(outdatedHint).not.toBeAttached()
  }

  await page.getByTestId(editActivityTestId(type, name)).click()
  await page.getByTestId('next-or-submit').click()
  await page.getByTestId('next-or-submit').click()
  await page.getByTestId('next-or-submit').click()
  await page.waitForTimeout(1000)
}

async function expectUpdateButtons(
  page: Page,
  {
    attached,
    detached,
  }: {
    attached?: string[]
    detached?: string[]
  }
) {
  for (const testId of attached ?? []) {
    await expect(page.getByTestId(testId)).toBeAttached()
  }
  for (const testId of detached ?? []) {
    await expect(page.getByTestId(testId)).not.toBeAttached()
  }
}

async function submitActivityUpdate(page: Page) {
  await page.getByTestId('next-or-submit').click()
  await expect(page.getByTestId('open-activity-overview')).toBeVisible()
}

async function expectNoUpdateHints(
  page: Page,
  {
    type,
    name,
    updateButtons,
  }: {
    type: ActivityType
    name: string
    updateButtons: string[]
  }
) {
  await openActivityEditView(page, { type, name, outdated: false })
  await expectUpdateButtons(page, {
    detached: ['update-all-outdated-instances', ...updateButtons],
  })
  await page.getByTestId('cancel-activity-creation').click()
}

async function editElementTitle(
  page: Page,
  oldTitle: string,
  newTitle: string
) {
  await searchAndEdit(page, oldTitle)
  await expect(page.getByTestId('insert-question-title')).toHaveValue(oldTitle)
  await page.getByTestId('insert-question-title').click()
  await page.getByTestId('insert-question-title').clear()
  await page.getByTestId('insert-question-title').pressSequentially(newTitle)
  await page.getByTestId('instance-update-switch').click()
  await saveElementModal(page)
  await validateElement(page, newTitle)
}

test.describe('Create different types of elements (with and without sample solution) and edit them', () => {
  test('Create different elements and activities of each type', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await createChoiceQuestions(page)
    await createAllActivities(page)

    await page.getByTestId('activities').click()
    await expectActivityDetails(page, {
      type: 'LIVE_QUIZ',
      name: data.instanceUpdates.liveQuizName,
      stacks: [
        [data.SCML.title, data.MCML.title, data.KPML.title],
        [data.SCML.title, data.MCML.title, data.KPML.title],
      ],
      outdated: false,
    })
    await expectActivityDetails(page, {
      type: 'PRACTICE_QUIZ',
      name: data.instanceUpdates.practiceQuizName,
      stacks: [
        [data.SCML.title, data.MCML.title, data.KPML.title],
        [data.SCML.title, data.MCML.title, data.KPML.title],
      ],
      outdated: false,
    })
    await expectActivityDetails(page, {
      type: 'MICRO_LEARNING',
      name: data.instanceUpdates.microlearningName,
      stacks: [
        [data.SCML.title, data.MCML.title, data.KPML.title],
        [data.SCML.title, data.MCML.title, data.KPML.title],
      ],
      outdated: false,
    })
    await expectActivityDetails(page, {
      type: 'GROUP_ACTIVITY',
      name: data.instanceUpdates.groupActivityName,
      stacks: [
        [
          data.SCML.title,
          data.MCML.title,
          data.KPML.title,
          data.SCML.title,
          data.MCML.title,
          data.KPML.title,
        ],
      ],
      outdated: false,
    })
  })

  test('Check the edit view of all activities and verify that no update hint is shown', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await expectNoUpdateHints(page, {
      type: 'LIVE_QUIZ',
      name: data.instanceUpdates.liveQuizName,
      updateButtons: [
        'update-element-0-block-0',
        'update-element-1-block-0',
        'update-element-2-block-0',
        'update-element-0-block-1',
        'update-element-1-block-1',
        'update-element-2-block-1',
      ],
    })
    await expectNoUpdateHints(page, {
      type: 'PRACTICE_QUIZ',
      name: data.instanceUpdates.practiceQuizName,
      updateButtons: [
        'update-element-0-stack-0',
        'update-element-1-stack-0',
        'update-element-2-stack-0',
        'update-element-0-stack-1',
        'update-element-1-stack-1',
        'update-element-2-stack-1',
      ],
    })
    await expectNoUpdateHints(page, {
      type: 'MICRO_LEARNING',
      name: data.instanceUpdates.microlearningName,
      updateButtons: [
        'update-element-0-stack-0',
        'update-element-1-stack-0',
        'update-element-2-stack-0',
        'update-element-0-stack-1',
        'update-element-1-stack-1',
        'update-element-2-stack-1',
      ],
    })
    await expectNoUpdateHints(page, {
      type: 'GROUP_ACTIVITY',
      name: data.instanceUpdates.groupActivityName,
      updateButtons: [
        'update-element-0-stack-0',
        'update-element-1-stack-0',
        'update-element-2-stack-0',
        'update-element-3-stack-0',
        'update-element-4-stack-0',
        'update-element-5-stack-0',
      ],
    })
  })

  test('Update the single choice question and the second instances in all activities', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await editElementTitle(
      page,
      data.SCML.title,
      data.instanceUpdates.newSCTitle
    )

    await openActivityEditView(page, {
      type: 'LIVE_QUIZ',
      name: data.instanceUpdates.liveQuizName,
      outdated: true,
    })
    await expectUpdateButtons(page, {
      attached: [
        'update-all-outdated-instances',
        'update-element-0-block-0',
        'update-element-0-block-1',
      ],
      detached: [
        'update-element-1-block-0',
        'update-element-2-block-0',
        'update-element-1-block-1',
        'update-element-2-block-1',
      ],
    })
    await page.getByTestId('update-element-0-block-1').click()
    await page.waitForTimeout(1000)
    await expectUpdateButtons(page, {
      attached: ['update-all-outdated-instances', 'update-element-0-block-0'],
      detached: [
        'update-element-1-block-0',
        'update-element-2-block-0',
        'update-element-0-block-1',
        'update-element-1-block-1',
        'update-element-2-block-1',
      ],
    })
    await submitActivityUpdate(page)

    await page.getByTestId('activities').click()
    await expectActivityDetails(page, {
      type: 'LIVE_QUIZ',
      name: data.instanceUpdates.liveQuizName,
      stacks: [
        [data.SCML.title, data.MCML.title, data.KPML.title],
        [data.instanceUpdates.newSCTitle, data.MCML.title, data.KPML.title],
      ],
      outdated: true,
    })

    for (const [type, name] of [
      ['PRACTICE_QUIZ', data.instanceUpdates.practiceQuizName],
      ['MICRO_LEARNING', data.instanceUpdates.microlearningName],
    ] as const) {
      await openActivityEditView(page, { type, name, outdated: true })
      await expectUpdateButtons(page, {
        attached: [
          'update-all-outdated-instances',
          'update-element-0-stack-0',
          'update-element-0-stack-1',
        ],
        detached: [
          'update-element-1-stack-0',
          'update-element-2-stack-0',
          'update-element-1-stack-1',
          'update-element-2-stack-1',
        ],
      })
      await page.getByTestId('update-element-0-stack-1').click()
      await page.waitForTimeout(1000)
      await expectUpdateButtons(page, {
        attached: ['update-all-outdated-instances', 'update-element-0-stack-0'],
        detached: [
          'update-element-1-stack-0',
          'update-element-2-stack-0',
          'update-element-0-stack-1',
          'update-element-1-stack-1',
          'update-element-2-stack-1',
        ],
      })
      await submitActivityUpdate(page)

      await page.getByTestId('activities').click()
      await expectActivityDetails(page, {
        type,
        name,
        stacks: [
          [data.SCML.title, data.MCML.title, data.KPML.title],
          [data.instanceUpdates.newSCTitle, data.MCML.title, data.KPML.title],
        ],
        outdated: true,
      })
    }

    await openActivityEditView(page, {
      type: 'GROUP_ACTIVITY',
      name: data.instanceUpdates.groupActivityName,
      outdated: true,
    })
    await expectUpdateButtons(page, {
      attached: [
        'update-all-outdated-instances',
        'update-element-0-stack-0',
        'update-element-3-stack-0',
      ],
      detached: [
        'update-element-1-stack-0',
        'update-element-2-stack-0',
        'update-element-4-stack-0',
        'update-element-5-stack-0',
      ],
    })
    await page.getByTestId('update-element-3-stack-0').click()
    await page.waitForTimeout(1000)
    await expectUpdateButtons(page, {
      attached: ['update-all-outdated-instances', 'update-element-0-stack-0'],
      detached: [
        'update-element-1-stack-0',
        'update-element-2-stack-0',
        'update-element-3-stack-0',
        'update-element-4-stack-0',
        'update-element-5-stack-0',
      ],
    })
    await submitActivityUpdate(page)

    await page.getByTestId('activities').click()
    await expectActivityDetails(page, {
      type: 'GROUP_ACTIVITY',
      name: data.instanceUpdates.groupActivityName,
      stacks: [
        [
          data.SCML.title,
          data.MCML.title,
          data.KPML.title,
          data.instanceUpdates.newSCTitle,
          data.MCML.title,
          data.KPML.title,
        ],
      ],
      outdated: true,
    })
  })

  test('Verify that update message disappears correctly after updating all instances in an activity', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await openActivityEditView(page, {
      type: 'LIVE_QUIZ',
      name: data.instanceUpdates.liveQuizName,
      outdated: true,
    })
    await expectUpdateButtons(page, {
      attached: ['update-all-outdated-instances', 'update-element-0-block-0'],
      detached: [
        'update-element-1-block-0',
        'update-element-2-block-0',
        'update-element-0-block-1',
        'update-element-1-block-1',
        'update-element-2-block-1',
      ],
    })
    await page.getByTestId('update-element-0-block-0').click()
    await page.waitForTimeout(1000)
    await expectUpdateButtons(page, {
      detached: [
        'update-all-outdated-instances',
        'update-element-0-block-0',
        'update-element-1-block-0',
        'update-element-2-block-0',
        'update-element-0-block-1',
        'update-element-1-block-1',
        'update-element-2-block-1',
      ],
    })
    await page.getByTestId('cancel-activity-creation').click()

    for (const [type, name] of [
      ['PRACTICE_QUIZ', data.instanceUpdates.practiceQuizName],
      ['MICRO_LEARNING', data.instanceUpdates.microlearningName],
    ] as const) {
      await openActivityEditView(page, { type, name, outdated: true })
      await expectUpdateButtons(page, {
        attached: ['update-all-outdated-instances', 'update-element-0-stack-0'],
        detached: [
          'update-element-1-stack-0',
          'update-element-2-stack-0',
          'update-element-0-stack-1',
          'update-element-1-stack-1',
          'update-element-2-stack-1',
        ],
      })
      await page.getByTestId('update-element-0-stack-0').click()
      await page.waitForTimeout(1000)
      await expectUpdateButtons(page, {
        detached: [
          'update-all-outdated-instances',
          'update-element-0-stack-0',
          'update-element-1-stack-0',
          'update-element-2-stack-0',
          'update-element-0-stack-1',
          'update-element-1-stack-1',
          'update-element-2-stack-1',
        ],
      })
      await page.getByTestId('cancel-activity-creation').click()
    }

    await openActivityEditView(page, {
      type: 'GROUP_ACTIVITY',
      name: data.instanceUpdates.groupActivityName,
      outdated: true,
    })
    await expectUpdateButtons(page, {
      attached: ['update-all-outdated-instances', 'update-element-0-stack-0'],
      detached: [
        'update-element-1-stack-0',
        'update-element-2-stack-0',
        'update-element-3-stack-0',
        'update-element-4-stack-0',
        'update-element-5-stack-0',
      ],
    })
    await page.getByTestId('update-element-0-stack-0').click()
    await page.waitForTimeout(1000)
    await expectUpdateButtons(page, {
      detached: [
        'update-all-outdated-instances',
        'update-element-0-stack-0',
        'update-element-1-stack-0',
        'update-element-2-stack-0',
        'update-element-3-stack-0',
        'update-element-4-stack-0',
        'update-element-5-stack-0',
      ],
    })
    await page.getByTestId('cancel-activity-creation').click()
  })

  test('Update the multiple choice question and update all outdated instances in all activities', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()

    await editElementTitle(
      page,
      data.MCML.title,
      data.instanceUpdates.newMCTitle
    )

    await openActivityEditView(page, {
      type: 'LIVE_QUIZ',
      name: data.instanceUpdates.liveQuizName,
      outdated: true,
    })
    await expectUpdateButtons(page, {
      attached: [
        'update-all-outdated-instances',
        'update-element-0-block-0',
        'update-element-1-block-0',
        'update-element-1-block-1',
      ],
      detached: [
        'update-element-2-block-0',
        'update-element-0-block-1',
        'update-element-2-block-1',
      ],
    })
    await page.getByTestId('update-all-outdated-instances').click()
    await page.waitForTimeout(1000)
    await expectUpdateButtons(page, {
      detached: [
        'update-all-outdated-instances',
        'update-element-0-block-0',
        'update-element-1-block-0',
        'update-element-2-block-0',
        'update-element-0-block-1',
        'update-element-1-block-1',
        'update-element-2-block-1',
      ],
    })
    await submitActivityUpdate(page)

    await page.getByTestId('activities').click()
    await expectActivityDetails(page, {
      type: 'LIVE_QUIZ',
      name: data.instanceUpdates.liveQuizName,
      stacks: [
        [
          data.instanceUpdates.newSCTitle,
          data.instanceUpdates.newMCTitle,
          data.KPML.title,
        ],
        [
          data.instanceUpdates.newSCTitle,
          data.instanceUpdates.newMCTitle,
          data.KPML.title,
        ],
      ],
      outdated: false,
    })

    for (const [type, name] of [
      ['PRACTICE_QUIZ', data.instanceUpdates.practiceQuizName],
      ['MICRO_LEARNING', data.instanceUpdates.microlearningName],
    ] as const) {
      await openActivityEditView(page, { type, name, outdated: true })
      await expectUpdateButtons(page, {
        attached: [
          'update-all-outdated-instances',
          'update-element-0-stack-0',
          'update-element-1-stack-0',
          'update-element-1-stack-1',
        ],
        detached: [
          'update-element-2-stack-0',
          'update-element-0-stack-1',
          'update-element-2-stack-1',
        ],
      })
      await page.getByTestId('update-all-outdated-instances').click()
      await page.waitForTimeout(1000)
      await expectUpdateButtons(page, {
        detached: [
          'update-all-outdated-instances',
          'update-element-0-stack-0',
          'update-element-1-stack-0',
          'update-element-2-stack-0',
          'update-element-0-stack-1',
          'update-element-1-stack-1',
          'update-element-2-stack-1',
        ],
      })
      await submitActivityUpdate(page)

      await page.getByTestId('activities').click()
      await expectActivityDetails(page, {
        type,
        name,
        stacks: [
          [
            data.instanceUpdates.newSCTitle,
            data.instanceUpdates.newMCTitle,
            data.KPML.title,
          ],
          [
            data.instanceUpdates.newSCTitle,
            data.instanceUpdates.newMCTitle,
            data.KPML.title,
          ],
        ],
        outdated: false,
      })
    }

    await openActivityEditView(page, {
      type: 'GROUP_ACTIVITY',
      name: data.instanceUpdates.groupActivityName,
      outdated: true,
    })
    await expectUpdateButtons(page, {
      attached: [
        'update-all-outdated-instances',
        'update-element-0-stack-0',
        'update-element-1-stack-0',
        'update-element-4-stack-0',
      ],
      detached: [
        'update-element-2-stack-0',
        'update-element-3-stack-0',
        'update-element-5-stack-0',
      ],
    })
    await page.getByTestId('update-all-outdated-instances').click()
    await page.waitForTimeout(1000)
    await expectUpdateButtons(page, {
      detached: [
        'update-all-outdated-instances',
        'update-element-0-stack-0',
        'update-element-1-stack-0',
        'update-element-2-stack-0',
        'update-element-3-stack-0',
        'update-element-4-stack-0',
        'update-element-5-stack-0',
      ],
    })
    await submitActivityUpdate(page)

    await page.getByTestId('activities').click()
    await expectActivityDetails(page, {
      type: 'GROUP_ACTIVITY',
      name: data.instanceUpdates.groupActivityName,
      stacks: [
        [
          data.instanceUpdates.newSCTitle,
          data.instanceUpdates.newMCTitle,
          data.KPML.title,
          data.instanceUpdates.newSCTitle,
          data.instanceUpdates.newMCTitle,
          data.KPML.title,
        ],
      ],
      outdated: false,
    })
  })
})
