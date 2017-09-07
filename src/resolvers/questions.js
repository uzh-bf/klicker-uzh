const AuthService = require('../services/auth')
const { QuestionModel, TagModel, UserModel } = require('../models')

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
const createQuestionMutation = async (parentValue, {
  question: {
    description, tags, title, type,
  },
}, { auth }) => {
  AuthService.isAuthenticated(auth)

  // if non-existent tags are passed, they need to be created
  // const fetchTags = await TagModel.find({ _id: { $in: tags } })
  const fetchTags = await TagModel.find({ name: { $in: tags } })
  const tagIds = fetchTags.map(tag => tag.id)

  const newQuestion = new QuestionModel({
    tags: [...tagIds],
    title,
    type,
    versions: [{ description, options: [], solution: {} }], // add an initial version 0
  })

  const updatedUser = UserModel.update(
    { _id: auth.sub },
    {
      $push: { questions: newQuestion.id },
      $currentDate: { updatedAt: true },
    },
  )

  await Promise.all([newQuestion.save(), updatedUser])

  return newQuestion
}

module.exports = {
  allQuestions: allQuestionsQuery,
  createQuestion: createQuestionMutation,
  question: questionQuery,
}
