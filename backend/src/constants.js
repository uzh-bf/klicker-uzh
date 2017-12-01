const QuestionTypes = {
  SC: 'SC',
  MC: 'MC',
  FREE: 'FREE',
  FREE_RANGE: 'FREE_RANGE',
}

const QuestionGroups = {
  CHOICES: [QuestionTypes.SC, QuestionTypes.MC],
  FREE: [QuestionTypes.FREE, QuestionTypes.FREE_RANGE],
  WITH_OPTIONS: [QuestionTypes.SC, QuestionTypes.MC, QuestionTypes.FREE_RANGE],
}

const QuestionBlockStatus = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  EXECUTED: 'EXECUTED',
}

const SessionStatus = {
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
}

module.exports = {
  QuestionTypes,
  QuestionGroups,
  QuestionBlockStatus,
  SessionStatus,
}
