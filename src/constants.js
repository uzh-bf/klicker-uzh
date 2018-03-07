export const SEMANTIC_VERSION = '2.2.14'

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

export const CHART_TYPES = {
  BAR_CHART: 'BAR_CHART',
  HISTOGRAM: 'HISTOGRAM',
  PIE_CHART: 'PIE_CHART',
  STACK_CHART: 'STACK_CHART',
  TABLE: 'TABLE',
}

export const QUESTION_GROUPS = {
  CHOICES: [QUESTION_TYPES.SC, QUESTION_TYPES.MC],
  FREE: [QUESTION_TYPES.FREE, QUESTION_TYPES.FREE_RANGE],
  WITH_POSSIBILITIES: [QUESTION_TYPES.SC, QUESTION_TYPES.MC, QUESTION_TYPES.FREE_RANGE],
  WITH_STATISTICS: [QUESTION_TYPES.FREE_RANGE],
}

export const CHART_DEFAULTS = {
  FREE: CHART_TYPES.TABLE,
  FREE_RANGE: CHART_TYPES.HISTOGRAM,
  MC: CHART_TYPES.STACK_CHART,
  OTHER: CHART_TYPES.TABLE,
  SC: CHART_TYPES.PIE_CHART,
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
  { content: 'Creation Date', id: 'CREATED', labelStart: 'sort numeric' },
  { content: 'Last Usage', id: 'USED', labelStart: 'sort numeric' },
  { content: 'Question Type', id: 'TYPE', labelStart: 'sort content' },
  { content: 'Title', id: 'TITLE', labelStart: 'sort alphabet' },
]

// break point for too small bars
// if the percentual responses of a bar are smaller than the given
// value, the label (A, B, ...)  is not displayed within the bar
// but on top of the bar
export const SMALL_BAR_THRESHOLD = 0.05

// break point for too small pies
// if the percentual responses of a pie are smaller than the given
// value, the label (A, B, ...)  is not displayed within the pie
// but outside right after the percentage
export const SMALL_PIE_THRESHOLD = 0.05

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
