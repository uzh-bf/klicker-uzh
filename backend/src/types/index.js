const Feedback = require('./Feedback')
const Question = require('./Question')
const Session = require('./Session')
const Tag = require('./Tag')
const User = require('./User')

module.exports = {
  allTypes: [Feedback, Question, Session, Tag, User],
  Feedback,
  Question,
  Session,
  Tag,
  User,
}
