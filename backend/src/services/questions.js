const isInteger = require('lodash/isInteger')

const { QuestionModel, TagModel, UserModel } = require('../models')

const { QuestionGroups, QuestionTypes } = require('../constants')

// process tags when editing or creating a question
const processTags = (existingTags, newTags, userId) => {
  // get references for the already existing tags
  const reusableTags = existingTags.filter(tag => newTags.includes(tag.name))
  const reusableTagNames = reusableTags.map(tag => tag.name)

  // if non-existent tags are passed, they need to be created
  const createdTags = [...new Set(newTags)]
    .filter(name => !reusableTagNames.includes(name))
    .map(name => new TagModel({ name, user: userId }))
  const createdTagIds = createdTags.map(tag => tag.id)

  // append the newly created tags to the list of tag ids
  const allTags = [...reusableTags, ...createdTags]
  const allTagIds = allTags.map(tag => tag.id)

  return {
    allTags,
    createdTags,
    allTagIds,
    createdTagIds,
  }
}

// create a new question
const createQuestion = async ({
  title, type, description, options, solution, tags, userId,
}) => {
  // if no tags have been assigned, throw
  if (!tags || tags.length === 0) {
    throw new Error('NO_TAGS_SPECIFIED')
  }

  // if no options have been assigned, throw
  if (QuestionGroups.WITH_OPTIONS.includes(type) && !options) {
    throw new Error('NO_OPTIONS_SPECIFIED')
  }

  if (QuestionGroups.CHOICES.includes(type)) {
    if (options.choices.length === 0) {
      throw new Error('NO_CHOICES_SPECIFIED')
    }

    if (solution && options.choices.length !== solution[type].length) {
      throw new Error('INVALID_SOLUTION')
    }
  }

  if (type === QuestionTypes.FREE_RANGE) {
    if (!options.restrictions) {
      throw new Error('MISSING_RESTRICTIONS')
    }

    const isMinInt = isInteger(options.restrictions.min)
    const isMaxInt = isInteger(options.restrictions.max)
    if ((!isMinInt && !isMaxInt) || options.restrictions.max <= options.restrictions.min) {
      throw new Error('INVALID_RESTRICTIONS')
    }
  }
  // find the corresponding user
  const user = await UserModel.findById(userId).populate(['tags'])

  // process tags
  const { allTagIds, allTags, createdTagIds } = processTags(user.tags, tags, userId)

  // create a new question
  // pass the list of tag ids for reference
  // create an initial version "0" containing the description, options and solution
  const newQuestion = new QuestionModel({
    tags: allTagIds,
    title,
    type,
    user: userId,
    versions: [
      {
        description,
        options: QuestionGroups.WITH_OPTIONS.includes(type) && {
          [type]: options,
        },
        solution,
      },
    ],
  })

  const allTagsUpdate = allTags.map((tag) => {
    tag.questions.push(newQuestion.id)
    return tag.save()
  })

  // push the new question and possibly tags into the user model
  user.questions.push(newQuestion.id)
  user.tags = user.tags.concat(createdTagIds)
  user.updatedAt = Date.now()

  // wait until the question and user both have been saved
  await Promise.all([newQuestion.save(), user.save(), ...allTagsUpdate])

  // return the new questions data
  return newQuestion
}

const modifyQuestion = async (questionId, userId, {
  title, tags, description, options, solution,
}) => {
  const promises = []

  // check if both description and options are set for a new version
  if (description ? !options : options) {
    throw new Error('INVALID_VERSION_DEFINITION')
  }

  // if no tags have been assigned, throw
  if (tags && tags.length === 0) {
    throw new Error('NO_TAGS_SPECIFIED')
  }

  // get the question to be modified
  const question = await QuestionModel.findOne({ _id: questionId, user: userId }).populate(['tags'])
  if (!question) {
    throw new Error('INVALID_QUESTION')
  }

  if (
    QuestionGroups.CHOICES.includes(question.type) &&
    solution &&
    options.choices.length !== solution[question.type].length
  ) {
    throw new Error('INVALID_SOLUTION')
  }

  // if the title is set to be modified
  if (title) {
    question.title = title
  }

  // if tags have been changed
  if (tags) {
    // find the corresponding user and corresponding tags
    const user = await UserModel.findById(userId).populate(['tags'])

    // process tags
    const { allTags, allTagIds } = processTags(user.tags, tags, userId)

    // update all tags to contain the question
    const allTagsUpdate = allTags.map((tag) => {
      // if the tag doesn't already contain the question, add it
      if (!tag.questions.includes(questionId)) {
        tag.questions.push(questionId)
      }

      return tag.save()
    })

    const oldTags = question.tags.filter(prevTag => !allTagIds.includes(prevTag.id))
    const oldTagsUpdate = oldTags.map((tag) => {
      // remove the current question from any old tag
      tag.questions = tag.questions.filter(({ id }) => id !== question.id) // eslint-disable-line

      return tag.save()
    })

    // set the question tags to the new tag list
    question.tags = allTags

    // replace the users tags
    user.tags = Array.from(new Set([...user.tags, ...allTags]))

    // add the tag updates to promises
    promises.concat(user.save(), allTagsUpdate, oldTagsUpdate)
  }

  // if description and options are set, add a new version
  if (description && options) {
    question.versions.push({
      description,
      options: QuestionGroups.WITH_OPTIONS.includes(question.type) && {
        // HACK: manually ensure randomized is default set to false
        // TODO: mongoose should do this..?
        [question.type]: QuestionGroups.CHOICES.includes(question.type) ? { randomized: false, ...options } : options,
      },
      solution,
    })
  }

  promises.push(question.save())

  await Promise.all(promises)

  return question
}

module.exports = {
  createQuestion,
  modifyQuestion,
}
