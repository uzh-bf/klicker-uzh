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
const createQuestionMutation = async (
  parentValue,
  {
    question: {
      description, options, tags, title, type,
    },
  },
  { auth },
) => {
  AuthService.isAuthenticated(auth)

  // find the corresponding user
  const user = await UserModel.findById(auth.sub).populate(['tags'])

  // get references for the already existing tags
  const existingTags = user.tags.filter(tag => tags.includes(tag.name))
  const existingTagNames = existingTags.map(tag => tag.name)

  // if non-existent tags are passed, they need to be created
  const newTags = [...new Set(tags)]
    .filter(name => !existingTagNames.includes(name))
    .map(name => new TagModel({ name, user: auth.sub }))

  // append the newly created tags to the list of tag ids
  const allTags = [...existingTags, ...newTags]

  // create a new question
  // pass the list of tag ids for reference
  // create an initial version "0" containing the description, options and solution
  const newQuestion = new QuestionModel({
    tags: [...allTags],
    title,
    type,
    versions: [{ description, options, solution: {} }],
  })

  const allTagsUpdate = allTags.map((tag) => {
    tag.questions.push(newQuestion)
    return tag.save()
  })

  // push the new question and possibly tags into the user model
  user.questions.push(newQuestion)
  user.tags = user.tags.concat(newTags)
  user.updatedAt = Date.now()

  // wait until the question and user both have been saved
  await Promise.all([newQuestion.save(), user.save(), ...allTagsUpdate])

  // return the new questions data
  return newQuestion
}

module.exports = {
  allQuestions: allQuestionsQuery,
  createQuestion: createQuestionMutation,
  question: questionQuery,
}
