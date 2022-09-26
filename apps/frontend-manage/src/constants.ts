export const SMALL_BAR_THRESHOLD = 0.05

export const SESSION_STATUS = {
  SCHEDULED: 'SCHEDULED',
  PREPARED: 'PREPARED',
  ACTIVE: 'ACTIVE',
  EXECUTED: 'EXECUTED',
}

export const CHART_TYPES = {
  BAR_CHART: 'BAR_CHART',
  CLOUD_CHART: 'CLOUD_CHART',
  HISTOGRAM: 'HISTOGRAM',
  PIE_CHART: 'PIE_CHART',
  STACK_CHART: 'STACK_CHART',
  TABLE: 'TABLE',
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

export const QUESTION_TYPES = {
  FREE_TEXT: 'FREE_TEXT',
  NUMERICAL: 'NUMERICAL',
  MC: 'MC',
  SC: 'SC',
  KPRIM: 'KPRIM',
}

export const QUESTION_GROUPS = {
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

export const QUESTION_SORTINGS = [
  { content: 'Creation Date', id: 'CREATED', labelStart: 'sort numeric' },
  { content: 'Last Usage', id: 'USED', labelStart: 'sort numeric' },
  { content: 'Question Type', id: 'TYPE', labelStart: 'sort content' },
  { content: 'Title', id: 'TITLE', labelStart: 'sort alphabet' },
]

export const QUESTION_TYPES_SHORT: Record<string, string> = {
  SC: 'SC',
  MC: 'MC',
  FREE_TEXT: 'FT',
  NUMERICAL: 'NR',
  KPRIM: 'KP',
}
