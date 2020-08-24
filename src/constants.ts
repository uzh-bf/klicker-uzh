export const Errors = {
  EMAIL_NOT_AVAILABLE: 'GraphQL error: EMAIL_NOT_AVAILABLE',
  SHORTNAME_NOT_AVAILABLE: 'GraphQL error: SHORTNAME_NOT_AVAILABLE',
}

export const SESSION_STATUS = {
  COMPLETED: 'COMPLETED',
  CREATED: 'CREATED',
  PAUSED: 'PAUSED',
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
  CLOUD_CHART: 'CLOUD_CHART',
  HISTOGRAM: 'HISTOGRAM',
  PIE_CHART: 'PIE_CHART',
  STACK_CHART: 'STACK_CHART',
  TABLE: 'TABLE',
  CONFUSION_BAROMETER_CHART: 'CONFUSION_BAROMETER_CHART',
}

export const QUESTION_GROUPS = {
  CHOICES: [QUESTION_TYPES.SC, QUESTION_TYPES.MC],
  FREE: [QUESTION_TYPES.FREE, QUESTION_TYPES.FREE_RANGE],
  WITH_PERCENTAGES: [QUESTION_TYPES.SC, QUESTION_TYPES.FREE],
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

export const CHANGELOG = {
  new: [
    {
      items: [
        'Add functionality for deletion of responses from the evaluation screen',
        'Improve answering of number range questions, fix errors in validation',
        'Improve distinction of archive and question pool',
        'Improve functionality and layout of tabular evaluation screen',
        'Miscellaneous improvements and optimizations',
      ],
      text: '1.0.0-rc.8 (09.08.2018)',
    },
    {
      items: [' Possibility to delete questions, sessions, and user accounts', ' Many, many other optimizations...'],
      text: '1.0.0-rc.3 (07.08.2018)',
    },
    {
      items: [
        'Possibility to change user data / password in the new account settings area',
        'Many overall usability improvements',
      ],
      text: '1.0.0-public.beta.44',
    },
    {
      items: ['Questions can now have images attached (beta)'],
      text: '1.0.0-public.beta.37',
    },
    {
      items: ['Sessions can be copied and modified in a single interaction'],
      text: '1.0.0-public.beta.35',
    },
    {
      items: [
        'Reworked session creation with possibility to reorder and remove questions within and in-between blocks',
        'Possibility to edit sessions (i.e., name and questions/blocks) that have not yet been started',
        'Optional publication of the session evaluation screen to the audience via a separate link (/sessions/public/:id)',
      ],
      text: '1.0.0-public.beta.34',
    },
    {
      items: ['Pausing sessions'],
      text: '1.0.0-public.beta.22',
    },
    {
      items: [
        'Rich-Text formatting for question content (for creation, modification and display on joining a session)',
        'The feature is experimental and formatting is not yet displayed on the evaluation screen',
      ],
      text: '1.0.0-public.beta.19',
    },
    {
      items: [
        'Executed question blocks can still be evaluated during a running session',
        'General improvements for the evaluation screen (added and moved around percentages and labels)',
      ],
      text: '1.0.0-public.beta.15',
    },
    {
      items: [
        'Archiving and unarchiving questions to enable question clean-up',
        'Quick creation of question blocks and sessions',
      ],
      text: '1.0.0-public.beta.7',
    },
    {
      items: [
        'Multiple-choice questions can be created and evaluated.',
        'One can define solutions for SC- and MC-questions and display them while presenting the results (optional).',
        'More advanced visualizations for all question types, including word clouds and aggregated tables.',
      ],
      text: 'Extended question types and visualizations',
    },
    {
      items: [
        'Questions can be grouped into sessions and question blocks.',
        'Each session could e.g. correspond to a single lecture.',
        'A question block is part of a session and represents a group of questions that are evaluated simultaneously.',
        'The parts of a session are activated on a predefined timeline.',
      ],
      text: 'Sessions & question blocks',
    },
    {
      items: [
        'The new feedback channel enables the collection of open text feedbacks over the course of the entire session (optional).',
        'It also allows the students to give feedback on the speed and difficulty of the session at any point in time (optional).',
      ],
      text: 'Feedback-Channel (experimental)',
    },
    {
      items: [
        'Currently supported languages are English and German.',
        'The tool is easily translateable to other languages (open-source).',
      ],
      text: 'Support for multiple languages',
    },
  ],
}
