const Question = require('./Question')
const QuestionInstance = require('./QuestionInstance')
const Session = require('./Session')
const Tag = require('./Tag')
const User = require('./User')
const SCQuestionOptions = require('./questionTypes/SCQuestionOptions')
const FREEQuestionOptions = require('./questionTypes/FREEQuestionOptions')
const SCQuestionResults = require('./questionTypes/SCQuestionResults')
const FREEQuestionResults = require('./questionTypes/FREEQuestionResults')

module.exports = {
  allTypes: [
    Question,
    QuestionInstance,
    SCQuestionOptions,
    SCQuestionResults,
    FREEQuestionOptions,
    FREEQuestionResults,
    Session,
    Tag,
    User,
  ],
  Question,
  QuestionInstance,
  SCQuestionOptions,
  SCQuestionResults,
  FREEQuestionOptions,
  FREEQuestionResults,
  Session,
  Tag,
  User,
}
