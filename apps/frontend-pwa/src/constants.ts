export const QUESTION_TYPES = {
  FREE_TEXT: 'FREE_TEXT',
  NUMERICAL: 'NUMERICAL',
  MC: 'MC',
  SC: 'SC',
}

export const AVATAR_OPTIONS = {
  skinTone: ['yellow'],
  eyes: ['normal', 'happy', 'content', 'squint', 'heart'],
  eyebrows: ['raised'],
  mouths: ['grin'],
  hair: ['long'],
  facialHair: ['none'],
  clothing: ['shirt'],
  accessory: ['roundGlasses'],
  graphic: ['none'],
  hat: ['none'],
  body: ['chest', 'breasts'],
  hairColor: ['blonde'],
  clothingColor: ['white'],
  lipColor: ['red'],
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
