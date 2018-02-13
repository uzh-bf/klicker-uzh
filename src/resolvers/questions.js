const QuestionService = require('../services/questions')
const { QuestionModel } = require('../models')

/* ----- queries ----- */
const allQuestionsQuery = async (parentValue, args, { auth }) =>
  QuestionModel.find({ user: auth.sub }).sort({ createdAt: -1 })

const questionQuery = async (parentValue, { id }, { auth }) => QuestionModel.findOne({ _id: id, user: auth.sub })

const questionByPVQuery = parentValue => QuestionModel.findById(parentValue.question)
const questionsByPVQuery = parentValue => QuestionModel.find({ _id: { $in: parentValue.questions } })

/* ----- mutations ----- */
const createQuestionMutation = (parentValue, { question }, { auth }) =>
  QuestionService.createQuestion({ ...question, userId: auth.sub })

const modifyQuestionMutation = (parentValue, { id, question }, { auth }) =>
  QuestionService.modifyQuestion(id, auth.sub, question)

module.exports = {
  // queries
  allQuestions: allQuestionsQuery,
  question: questionQuery,
  questionByPV: questionByPVQuery,
  questionsByPV: questionsByPVQuery,

  // mutations
  createQuestion: createQuestionMutation,
  modifyQuestion: modifyQuestionMutation,
}
