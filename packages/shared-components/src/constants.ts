import { QuestionType, SessionStatus } from '@klicker-uzh/graphql/dist/ops'

export const SMALL_BAR_THRESHOLD: number = 0.05

export const SESSION_STATUS: Record<SessionStatus, string> = {
  PREPARED: 'PREPARED',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
}

export const CHART_TYPES: Record<string, string> = {
  BAR_CHART: 'BAR_CHART',
  CLOUD_CHART: 'CLOUD_CHART',
  HISTOGRAM: 'HISTOGRAM',
  PIE_CHART: 'PIE_CHART',
  STACK_CHART: 'STACK_CHART',
  TABLE: 'TABLE',
}

export const CHART_COLORS: string[] = [
  'rgb(19, 149, 186)', // 1
  'rgb(241, 108, 32)', // 7
  'rgb(13, 60, 85)', // 4
  'rgb(235, 200, 68)', // 10
  'rgb(192, 46, 29)', // 5
  'rgb(162, 184, 108)', // 11
  'rgb(239, 139, 44)', // 8
  'rgb(17, 120, 153)', // 2
  'rgb(217, 78, 31)', // 6
  'rgb(92, 167, 147)', // 12
  'rgb(15, 91, 120)', // 3
  'rgb(236, 170, 56)', // 9
]

export const CHART_SOLUTION_COLORS = {
  correct: '#00de0d',
  incorrect: '#ff0000',
}

export const QUESTION_TYPES: Record<QuestionType, string> = {
  FREE_TEXT: 'FREE_TEXT',
  NUMERICAL: 'NUMERICAL',
  MC: 'MC',
  SC: 'SC',
  KPRIM: 'KPRIM',
}

export const QUESTION_GROUPS: Record<string, string[]> = {
  CHOICES: [QUESTION_TYPES.SC, QUESTION_TYPES.MC, QUESTION_TYPES.KPRIM],
  FREE_TEXT: [QUESTION_TYPES.FREE_TEXT],
  NUMERICAL: [QUESTION_TYPES.NUMERICAL],
  FREE: [QUESTION_TYPES.FREE_TEXT, QUESTION_TYPES.NUMERICAL],
  WITH_PERCENTAGES: [
    QUESTION_TYPES.SC,
    QUESTION_TYPES.MC,
    QUESTION_TYPES.KPRIM,
    QUESTION_TYPES.FREE_TEXT,
  ],
  WITH_POSSIBILITIES: [
    QUESTION_TYPES.SC,
    QUESTION_TYPES.MC,
    QUESTION_TYPES.KPRIM,
    QUESTION_TYPES.NUMERICAL,
  ],
  WITH_STATISTICS: [QUESTION_TYPES.NUMERICAL],
}

export const QUESTION_TYPES_SHORT: Record<QuestionType, string> = {
  SC: 'SC',
  MC: 'MC',
  FREE_TEXT: 'FT',
  NUMERICAL: 'NR',
  KPRIM: 'KP',
}

export const AVATAR_OPTIONS: Record<string, string[]> = {
  hair: ['long', 'bun', 'short', 'buzz', 'afro'],
  hairColor: ['blonde', 'black', 'brown'],
  eyes: ['normal', 'happy', 'content', 'squint', 'heart', 'wink'],
  accessory: ['none', 'roundGlasses', 'tinyGlasses', 'shades'],
  mouth: ['grin', 'openSmile', 'serious'],
  facialHair: ['none', 'stubble', 'mediumBeard'],
  clothing: ['shirt', 'dress', 'dressShirt'],
  clothingColor: ['blue', 'green', 'red'],
  skinTone: ['light', 'dark'],
  // eyebrows: ['raised'],
  // graphic: ['none'],
  // hat: ['none'],
  // body: ['breasts', 'chest'],
}

export const TYPES_SHORT: Record<QuestionType, string> = {
  NUMERICAL: 'NR',
  FREE_TEXT: 'FT',
  MC: 'MC',
  SC: 'SC',
  KPRIM: 'KP',
}

export const ACTIVE_CHART_TYPES: Record<
  string,
  { label: string; value: string }[]
> = {
  FREE_TEXT: [
    { label: 'manage.evaluation.table', value: 'table' },
    { label: 'manage.evaluation.wordCloud', value: 'wordCloud' },
  ],
  NUMERICAL: [
    { label: 'manage.evaluation.histogram', value: 'histogram' },
    { label: 'manage.evaluation.table', value: 'table' },
    { label: 'manage.evaluation.barChart', value: 'barChart' },
    { label: 'manage.evaluation.wordCloud', value: 'wordCloud' },
  ],
  SC: [
    { label: 'manage.evaluation.barChart', value: 'barChart' },
    { label: 'manage.evaluation.table', value: 'table' },
  ],
  MC: [
    { label: 'manage.evaluation.barChart', value: 'barChart' },
    { label: 'manage.evaluation.table', value: 'table' },
  ],
  KPRIM: [
    { label: 'manage.evaluation.barChart', value: 'barChart' },
    { label: 'manage.evaluation.table', value: 'table' },
  ],
}

export const STATISTICS_ORDER: string[] = [
  'min',
  'max',
  'mean',
  'median',
  'q1',
  'q3',
  'sd',
]

export const LEARNING_ELEMENT_ORDERS: Record<string, string> = {
  SEQUENTIAL: 'Sequenziell',
  SHUFFLED: 'Zufällig',
  LAST_RESPONSE: 'Letzte Antwort zuletzt',
}

export const PRESET_COURSE_COLORS = [
  '#262FAD',
  '#016272',
  '#5FB1F9',
  '#FE7408',
  '#D84B39',
]
