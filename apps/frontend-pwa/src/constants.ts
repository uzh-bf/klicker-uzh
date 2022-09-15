export const QUESTION_TYPES = {
  FREE_TEXT: 'FREE_TEXT',
  NUMERICAL: 'NUMERICAL',
  MC: 'MC',
  SC: 'SC',
}

export const AVATAR_OPTIONS = {
  skinTone: ['light', 'dark'],
  eyes: ['normal', 'happy', 'content', 'squint', 'heart'],
  eyebrows: ['raised'],
  mouth: ['grin', 'openSmile', 'open', 'serious', 'tongue'],
  hair: ['long', 'bun', 'short', 'buzz', 'afro'],
  facialHair: ['none'],
  clothing: ['shirt'],
  accessory: ['none', 'roundGlasses', 'tinyGlasses', 'shades'],
  graphic: ['none'],
  hat: ['none'],
  body: ['chest', 'breasts'],
  hairColor: ['blonde', 'black', 'brown'],
  clothingColor: ['white', 'blue', 'green', 'red'],
}

export const AVATAR_LABELS = {
  breasts: 'Weiblich',
  chest: 'Männlich',
  normal: 'Normal',
  happy: 'Glücklich',
  content: 'Zufrieden',
  squint: 'Fokussiert',
  heart: 'Herzen',
  light: 'Hell',
  dark: 'Dunkel',
  long: 'Lang',
  bun: 'Dutt',
  short: 'Kurz',
  buzz: 'Sehr Kurz',
  afro: 'Afro',
  blonde: 'Blond',
  black: 'Schwarz',
  brown: 'Braun',
  white: 'Weiss',
  blue: 'Blau',
  green: 'Grün',
  red: 'Rot',
  grin: 'Grinsen',
  openSmile: 'Lachen',
  open: 'Offen',
  serious: 'Ernst',
  tongue: 'Zunge',
  none: 'Keine',
  roundGlasses: 'Sehbrille',
  tinyGlasses: 'Lesebrille',
  shades: 'Sonnenbrille'
}

export const QUESTION_GROUPS = {
  CHOICES: [QUESTION_TYPES.SC, QUESTION_TYPES.MC],
  FREE_TEXT: [QUESTION_TYPES.FREE_TEXT],
  NUMERICAL: [QUESTION_TYPES.NUMERICAL],
  FREE: [QUESTION_TYPES.FREE_TEXT, QUESTION_TYPES.NUMERICAL],
  WITH_PERCENTAGES: [
    QUESTION_TYPES.SC,
    QUESTION_TYPES.MC,
    QUESTION_TYPES.FREE_TEXT,
  ],
  WITH_POSSIBILITIES: [
    QUESTION_TYPES.SC,
    QUESTION_TYPES.MC,
    QUESTION_TYPES.NUMERICAL,
  ],
  WITH_STATISTICS: [QUESTION_TYPES.NUMERICAL],
}
