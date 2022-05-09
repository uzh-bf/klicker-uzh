const { QuestionModel } = require('@klicker-uzh/db')
const QuestionService = require('../services/questions')
const StatisticsService = require('../services/statistics')
const { ensureLoaders } = require('../lib/loaders')

/* ----- queries ----- */
const allQuestionsQuery = async (parentValue, args, { auth, loaders }) => {
  // get all the questions for the given user
  const results = await QuestionModel.find({ isDeleted: false, user: auth.sub }).sort({ createdAt: -1 })

  // prime the dataloader cache
  results.forEach((question) => ensureLoaders(loaders).questions.prime(question.id, question))

  return results
}

const questionQuery = async (parentValue, { id }, { loaders }) => ensureLoaders(loaders).questions.load(id)
const questionByPVQuery = (parentValue, args, { loaders }) =>
  ensureLoaders(loaders).questions.load(parentValue.question)
const questionsByPVQuery = (parentValue, args, { loaders }) => {
  const loader = ensureLoaders(loaders).questions
  return Promise.all(parentValue.questions.map((question) => loader.load(question)))
}

/* ----- mutations ----- */
const createQuestionMutation = (parentValue, { question }, { auth }) =>
  QuestionService.createQuestion({ ...question, userId: auth.sub })

const modifyQuestionMutation = (parentValue, { id, question }, { auth }) =>
  QuestionService.modifyQuestion(id, auth.sub, question)

const archiveQuestionsMutation = (parentValue, { ids }, { auth }) =>
  QuestionService.archiveQuestions({ ids, userId: auth.sub })

const deleteQuestionsMutation = (parentValue, { ids }, { auth }) =>
  QuestionService.deleteQuestions({ ids, userId: auth.sub })

const questionStatisticsMutation = (parentValue, { ids }, { auth }) =>
  StatisticsService.computeQuestionStatistics({ ids, userId: auth.sub })

const exportQuestionsMutation = (parentValue, { ids }, { auth }) =>
  QuestionService.exportQuestions({ ids, userId: auth.sub })

module.exports = {
  // queries
  allQuestions: allQuestionsQuery,
  question: questionQuery,
  questionByPV: questionByPVQuery,
  questionsByPV: questionsByPVQuery,

  // mutations
  createQuestion: createQuestionMutation,
  modifyQuestion: modifyQuestionMutation,
  archiveQuestions: archiveQuestionsMutation,
  deleteQuestions: deleteQuestionsMutation,
  questionStatistics: questionStatisticsMutation,
  exportQuestions: exportQuestionsMutation,
}
