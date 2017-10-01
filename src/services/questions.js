const { QuestionModel, TagModel, UserModel } = require('../models')

// create a new question
const createQuestion = async ({
  title, type, description, options, tags, userId,
}) => {
  // if no tags have been assigned, throw
  if (tags.length === 0) {
    throw new Error('NO_TAGS_SPECIFIED')
  }

  // find the corresponding user
  const user = await UserModel.findById(userId).populate(['tags'])

  // get references for the already existing tags
  const existingTags = user.tags.filter(tag => tags.includes(tag.name))
  const existingTagNames = existingTags.map(tag => tag.name)

  // if non-existent tags are passed, they need to be created
  const newTags = [...new Set(tags)]
    .filter(name => !existingTagNames.includes(name))
    .map(name => new TagModel({ name, user: userId }))

  // append the newly created tags to the list of tag ids
  const allTags = [...existingTags, ...newTags]

  // create a new question
  // pass the list of tag ids for reference
  // create an initial version "0" containing the description, options and solution
  const newQuestion = new QuestionModel({
    tags: [...allTags],
    title,
    type,
    user: userId,
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
  createQuestion,
}
