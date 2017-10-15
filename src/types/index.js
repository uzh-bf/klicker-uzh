const Question = require('./Question')
const QuestionInstance = require('./QuestionInstance')
const Session = require('./Session')
const Tag = require('./Tag')
const User = require('./User')
const SCQuestionOptions = require('./questionTypes/SCQuestionOptions')
const FREEQuestionOptions = require('./questionTypes/FREEQuestionOptions')

module.exports = {
  allTypes: [
    Question,
    QuestionInstance,
    SCQuestionOptions,
    FREEQuestionOptions,
    Session,
    Tag,
    User,
  ],
  Question,
  QuestionInstance,
  SCQuestionOptions,
  FREEQuestionOptions,
  Session,
  Tag,
  User,
}
