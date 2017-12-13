export const SEMANTIC_VERSION = '2.2.13'

export const SESSION_STATUS = {
  COMPLETED: 'COMPLETED',
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
}

export const QUESTION_TYPES = {
  FREE: 'FREE',
  FREE_RANGE: 'FREE_RANGE',
  MC: 'MC',
  SC: 'SC',
}

export const QUESTION_GROUPS = {
  CHOICES: [QUESTION_TYPES.SC, QUESTION_TYPES.MC],
  FREE: [QUESTION_TYPES.FREE, QUESTION_TYPES.FREE_RANGE],
  WITH_POSSIBILITIES: [QUESTION_TYPES.SC, QUESTION_TYPES.MC, QUESTION_TYPES.FREE_RANGE],
  WITH_STATISTICS: [QUESTION_TYPES.FREE_RANGE],
}

export const CHART_DEFAULTS = {
  FREE: 'TABLE',
  FREE_RANGE: 'HISTOGRAM',
  MC: 'STACK_CHART',
  OTHER: 'TABLE',
  SC: 'PIE_CHART',
}

export const CHART_COLORS = [
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

export const QUESTION_SORTINGS = [
  { content: 'Title', id: 'TITLE', labelStart: 'sort alphabet' },
  { content: '# of votes', id: 'VOTES', labelStart: 'sort numeric' },
  { content: 'Question Type', id: 'TYPE', labelStart: 'sort content' },
  { content: 'Create Date', id: 'CREATED', labelStart: 'sort numeric' },
]

// https://www.viget.com/articles/add-colors-to-your-palette-with-color-mixing
// original circle
/* export const CHART_COLORS = [
  rgb(19, 149, 186), // 1
  rgb(17, 120, 153), // 2
  rgb(15, 91, 120),  // 3
  rgb(13, 60, 85),   // 4
  rgb(192, 46, 29),  // 5
  rgb(217, 78, 31),  // 6
  rgb(241, 108, 32), // 7
  rgb(239, 139, 44), // 8
  rgb(236, 170, 56), // 9
  rgb(235, 200, 68), // 10
  rgb(162, 184, 108),// 11
  rgb(92, 167, 147),// 12
] */
