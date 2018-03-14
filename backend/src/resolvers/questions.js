const QuestionService = require('../services/questions')
const { ensureLoaders } = require('../lib/utils')
const { QuestionModel } = require('../models')

/* ----- queries ----- */
const allQuestionsQuery = async (parentValue, args, { auth, loaders }) => {
  // get all the questions for the given user
  const results = await QuestionModel.find({ user: auth.sub }).sort({ createdAt: -1 })

  // prime the dataloader cache
  results.forEach(question => ensureLoaders(loaders).questions.prime(question.id, question))

  return results
}

const questionQuery = async (parentValue, { id }, { loaders }) => ensureLoaders(loaders).questions.load(id)
const questionByPVQuery = (parentValue, args, { loaders }) =>
  ensureLoaders(loaders).questions.load(parentValue.question)
const questionsByPVQuery = (parentValue, args, { loaders }) =>
  ensureLoaders(loaders).questions.loadMany(parentValue.questions)

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
