import { createAdaptiveSeed } from '@klicker-uzh/adaptive-persistence/seed'
import { COURSE_ID_TEST, COURSE_ID_TEST2, USER_ID_TEST } from './constants.js'
import { prepareQuestion } from './helpers.js'

export const { seedAdaptivePracticeQuizV2 } = createAdaptiveSeed({
  COURSE_ID_TEST,
  COURSE_ID_TEST2,
  USER_ID_TEST,
  prepareQuestion,
})
