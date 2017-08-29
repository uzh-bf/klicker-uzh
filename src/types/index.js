const Feedback = require('./Feedback')
const Question = require('./Question')
const QuestionInstance = require('./QuestionInstance')
const QuestionVersion = require('./QuestionVersion')
const Session = require('./Session')
const Tag = require('./Tag')
const User = require('./User')

module.exports = {
  allTypes: [Feedback, Question, QuestionInstance, QuestionVersion, Session, Tag, User],
  Feedback,
  Question,
  QuestionInstance,
  QuestionVersion,
  Session,
  Tag,
  User,
}
