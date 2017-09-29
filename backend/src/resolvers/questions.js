const AuthService = require('../services/auth')
const QuestionService = require('../services/questions')
const { QuestionModel, UserModel } = require('../models')

/* ----- queries ----- */
const allQuestionsQuery = async (parentValue, args, { auth }) => {
  AuthService.isAuthenticated(auth)

  // TODO: only populate tags if asked for in the query
  const user = await UserModel.findById(auth.sub).populate({ path: 'questions', populate: { path: 'tags' } })

  return user.questions
}

const questionQuery = (parentValue, { id }, { auth }) => {
  AuthService.isAuthenticated(auth)

  // TODO: only populate tags if asked for in the query
  return QuestionModel.findOne({ id, user: auth.sub }).populate({ path: 'questions', populate: { path: 'tags' } })
}

/* ----- mutations ----- */
const createQuestionMutation = (parentValue, { question }, { auth }) => {
  AuthService.isAuthenticated(auth)

  return QuestionService.createQuestion({ ...question, userId: auth.sub })
}

module.exports = {
  allQuestions: allQuestionsQuery,
  createQuestion: createQuestionMutation,
  question: questionQuery,
}
