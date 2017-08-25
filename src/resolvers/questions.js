const AuthService = require('../services/auth')
const { QuestionModel, TagModel, UserModel } = require('../models')

/* ----- queries ----- */
const allQuestionsQuery = async (parentValue, args, { auth }) => {
  AuthService.isAuthenticated(auth)

  const user = await UserModel.findById(auth.sub).populate(['questions'])
  return user.questions
}

const questionQuery = (parentValue, { id }, { auth }) => {
  AuthService.isAuthenticated(auth)

  return QuestionModel.findOne({ id, user: auth.sub })
}

/* ----- mutations ----- */
const createQuestionMutation = async (parentValue, { question: { tags, title, type } }, { auth }) => {
  AuthService.isAuthenticated(auth)

  // if non-existent tags are passed, they need to be created
  const fetchTags = await TagModel.find({ _id: { $in: tags } })

  const newQuestion = await new QuestionModel({
    tags: fetchTags,
    title,
    type,
  }).save()

  const user = await UserModel.findById(auth.sub).populate(['questions'])
  user.questions.push(newQuestion.id)

  user.update({
    $set: { questions: [...user.questions, newQuestion.id] },
    $currentDate: { updatedAt: true },
  })

  return newQuestion
}

module.exports = {
  allQuestions: allQuestionsQuery,
  createQuestion: createQuestionMutation,
  question: questionQuery,
}
