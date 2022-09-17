export const QUESTION_TYPES = {
  FREE_TEXT: 'FREE_TEXT',
  NUMERICAL: 'NUMERICAL',
  MC: 'MC',
  SC: 'SC',
  KPRIM: 'KPRIM',
}

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

// TODO: remove if unused
// export const AVATAR_OPTIONS = {
//   skinTone: ['light', 'dark'],
//   eyes: ['normal', 'happy', 'content', 'squint', 'heart', 'wink'],
//   eyebrows: ['raised'],
//   mouth: ['grin', 'openSmile', 'serious'],
//   hair: ['long', 'bun', 'short', 'buzz', 'afro'],
//   facialHair: ['none', 'stubble', 'mediumBeard'],
//   clothing: ['shirt'],
//   accessory: ['none', 'roundGlasses', 'tinyGlasses', 'shades'],
//   graphic: ['none'],
//   hat: ['none'],
//   body: ['breasts', 'chest'],
//   hairColor: ['blonde', 'black', 'brown'],
//   clothingColor: ['blue', 'green', 'red'],
// }

// TODO: remove if unused
// export const AVATAR_LABELS = {
//   breasts: 'Weiblich',
//   chest: 'Männlich',
//   normal: 'Normal',
//   happy: 'Glücklich',
//   content: 'Zufrieden',
//   squint: 'Fokussiert',
//   heart: 'Herzen',
//   light: 'Hell',
//   dark: 'Dunkel',
//   long: 'Lang',
//   bun: 'Dutt',
//   short: 'Kurz',
//   buzz: 'Sehr Kurz',
//   afro: 'Afro',
//   blonde: 'Blond',
//   black: 'Schwarz',
//   brown: 'Braun',
//   white: 'Weiss',
//   blue: 'Blau',
//   green: 'Grün',
//   red: 'Rot',
//   grin: 'Grinsen',
//   openSmile: 'Lachen',
//   open: 'Offen',
//   serious: 'Ernst',
//   tongue: 'Zunge',
//   none: 'Keine',
//   roundGlasses: 'Sehbrille',
//   tinyGlasses: 'Lesebrille',
//   shades: 'Sonnenbrille',
//   stubble: 'Stoppeln',
//   mediumBeard: 'Bart',
//   wink: 'Zwinkern',
// }

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
