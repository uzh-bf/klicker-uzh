const _isNumber = require('lodash/isNumber')
const { ContentState, convertToRaw } = require('draft-js')
const { UserInputError } = require('apollo-server-express')

const { QuestionModel, TagModel, UserModel, FileModel } = require('../models')
const { QUESTION_GROUPS, QUESTION_TYPES } = require('../constants')
const { convertToPlainText } = require('../lib/draft')

/**
 * Process tags when editing or creating a question
 * @param {*} existingTags
 * @param {*} newTags
 * @param {*} userId
 */
const processTags = (existingTags, newTags, userId) => {
  // get references for the already existing tags
  const reusableTags = existingTags.filter((tag) => newTags.includes(tag.name))
  const reusableTagNames = reusableTags.map((tag) => tag.name)

  // if non-existent tags are passed, they need to be created
  const createdTags = [...new Set(newTags)]
    .filter((name) => !reusableTagNames.includes(name))
    .map((name) => new TagModel({ name, user: userId }))
  const createdTagIds = createdTags.map((tag) => tag.id)

  // append the newly created tags to the list of tag ids
  const allTags = [...reusableTags, ...createdTags]
  const allTagIds = allTags.map((tag) => tag.id)

  return {
    allTags,
    createdTags,
    allTagIds,
    createdTagIds,
  }
}

/**
 *
 * @param {*} files
 * @param {*} userId
 */
const processFiles = (files = [], userId) => {
  // extract the ids of already existing files
  const existingFiles = files.filter((file) => file.id)
  const modifiedFiles = existingFiles.flatMap(async (existingFile) => {
    const updatedFile = await FileModel.findById(existingFile.id)
    if (updatedFile.description !== existingFile.description) {
      updatedFile.description = existingFile.description
      return updatedFile.save()
    }
    return null
  })

  // create models for entirely new files
  const createdFiles = files
    .filter((file) => !file.id)
    .map(
      ({ name, originalName, type, description }) =>
        new FileModel({
          name,
          originalName,
          type,
          description,
          user: userId,
        })
    )

  return {
    createdFiles,
    modifiedFiles,
    createdFileIds: createdFiles.map((file) => file.id),
    existingFileIds: existingFiles.map((file) => file.id),
  }
}

/**
 * Create a new question
 * @param {*} param0
 */
const createQuestion = async ({ title, type, content, options, solution, files, tags, userId }) => {
  // if no tags have been assigned, throw
  if (!tags || tags.length === 0) {
    throw new UserInputError('NO_TAGS_SPECIFIED')
  }

  // if no options have been assigned, throw
  if (QUESTION_GROUPS.WITH_OPTIONS.includes(type) && !options) {
    throw new UserInputError('NO_OPTIONS_SPECIFIED')
  }

  // validation for SC and MC questions
  if (QUESTION_GROUPS.CHOICES.includes(type)) {
    if (options.choices.length === 0) {
      throw new UserInputError('NO_CHOICES_SPECIFIED')
    }

    if (solution && options.choices.length !== solution[type].length) {
      throw new UserInputError('INVALID_SOLUTION')
    }
  }

  // validation for FREE_RANGE questions
  if (type === QUESTION_TYPES.FREE_RANGE) {
    if (!options.restrictions) {
      throw new UserInputError('MISSING_RESTRICTIONS')
    }

    // if at least one restriction is set, the restrictions need to be evaluated
    if (options.restrictions.min || options.restrictions.max) {
      const isMinNum = !options.restrictions.min || _isNumber(options.restrictions.min)
      const isMaxNum = !options.restrictions.max || _isNumber(options.restrictions.max)
      if (
        !isMinNum ||
        !isMaxNum ||
        (options.restrictions.min && options.restrictions.max && options.restrictions.max <= options.restrictions.min)
      ) {
        throw new UserInputError('INVALID_RESTRICTIONS')
      }
    }
  }
  // find the corresponding user
  const user = await UserModel.findById(userId).populate(['tags'])

  // process tags
  const { allTagIds, allTags, createdTagIds } = processTags(user.tags, tags, userId)

  // process files
  const { createdFiles, createdFileIds, existingFileIds } = processFiles(files, userId)

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
        content,
        description: convertToPlainText(content),
        options: QUESTION_GROUPS.WITH_OPTIONS.includes(type) && {
          [type]: options,
        },
        files: existingFileIds.concat(createdFileIds),
        solution,
      },
    ],
  })

  const allTagsUpdate = allTags.map((tag) => {
    tag.questions.push(newQuestion.id)
    return tag.save()
  })

  const allFilesSave = createdFiles.map((file) => file.save())

  // push the new question and possibly tags into the user model
  user.questions.push(newQuestion.id)
  user.tags = user.tags.concat(createdTagIds)
  user.files = user.files.concat(createdFileIds)

  // wait until the question and user both have been saved
  await Promise.all([newQuestion.save(), user.save(), Promise.all(allTagsUpdate), Promise.all(allFilesSave)])

  // return the new questions data
  return newQuestion
}

/**
 *
 * @param {*} questionId
 * @param {*} userId
 * @param {*} param2
 */
const modifyQuestion = async (questionId, userId, { title, tags, content, options, solution, files }) => {
  const promises = []

  // check if both content and options are set for a new version
  if (content ? !options : options) {
    throw new UserInputError('INVALID_VERSION_DEFINITION')
  }

  // if no tags have been assigned, throw
  if (tags && tags.length === 0) {
    throw new UserInputError('NO_TAGS_SPECIFIED')
  }

  // get the question to be modified
  const question = await QuestionModel.findOne({
    _id: questionId,
    user: userId,
  }).populate(['tags'])
  if (!question) {
    throw new UserInputError('INVALID_QUESTION')
  }

  if (
    QUESTION_GROUPS.CHOICES.includes(question.type) &&
    solution &&
    options.choices.length !== solution[question.type].length
  ) {
    throw new UserInputError('INVALID_SOLUTION')
  }

  // if the title is set to be modified
  if (title) {
    question.title = title
  }

  // find the corresponding user and corresponding tags
  const user = await UserModel.findById(userId).populate(['tags'])

  // if tags have been changed
  if (tags) {
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

    const oldTags = question.tags.filter((prevTag) => !allTagIds.includes(prevTag.id))
    const oldTagsUpdate = oldTags.map((tag) => {
      // remove the current question from any old tag
      tag.questions = tag.questions.filter(({ id }) => id !== question.id) // eslint-disable-line

      return tag.save()
    })

    // set the question tags to the new tag list
    question.tags = allTagIds

    // replace the users tags
    user.tags = Array.from(new Set([...user.tags, ...allTags]))

    // add the tag updates to promises
    promises.push(allTagsUpdate, oldTagsUpdate)
  }

  // migrate old question versions without content field
  for (let i = 0; i < question.versions.length; i += 1) {
    // if the content field is not set on any old version
    if (!question.versions[i].content) {
      // get the description of the old version
      const { description } = question.versions[i]

      // instantiate a content state
      const contentState = ContentState.createFromText(description)

      // convert the content state to raw json
      const rawContent = JSON.stringify(convertToRaw(contentState))

      // set the content of the version to the raw state
      question.versions[i].content = rawContent
      question.markModified(`versions.${i}`)
    }
  }

  // TODO: ensure that content is not empty
  // if content and options, or files, are set, add a new version
  if ((content && options) || files) {
    // extract the last version of the question
    const lastVersion = question.versions[question.versions.length - 1]

    // process files
    const { createdFiles, createdFileIds, existingFileIds, modifiedFiles } = processFiles(files, userId)

    // replace the files of the user
    if (files) {
      user.files = Array.from(new Set([...user.files, ...createdFileIds]))
      promises.push(
        createdFiles.map((file) => file.save()),
        modifiedFiles
      )
    }

    // push a new version into the question model
    question.versions.push({
      content: content || lastVersion.content,
      description: content ? convertToPlainText(content) : lastVersion.description,
      options: options
        ? QUESTION_GROUPS.WITH_OPTIONS.includes(question.type) && {
            // HACK: manually ensure randomized is default set to false
            // TODO: mongoose should do this..?
            [question.type]: QUESTION_GROUPS.CHOICES.includes(question.type)
              ? { randomized: false, ...options }
              : options,
          }
        : lastVersion.options,
      files: files ? existingFileIds.concat(createdFileIds) : lastVersion.files,
      solution: solution || lastVersion.solution,
    })
  }

  promises.push(question.save())

  // if tags or files have been changed, save the user
  if (tags || files) {
    promises.push(user.save())
  }

  await Promise.all(promises)

  return question
}

/**
 *
 * @param {*} questionIds
 * @param {*} userId
 */
const archiveQuestions = async ({ ids, userId }) => {
  // get the question instance from the DB
  const questions = await QuestionModel.find({
    _id: { $in: ids },
    user: userId,
  })

  // set the questions to be archived if it does not yet have the attribute
  // otherwise invert the previously set value
  const promises = questions.map((question) => {
    // eslint-disable-next-line no-param-reassign
    question.isArchived = !question.isArchived
    return question.save()
  })

  // await the question update promises
  return Promise.all(promises)
}

/**
 * Delete a question from the database
 * @param {*} param0
 */
const deleteQuestions = async ({ ids, userId }) => {
  // perform soft deletion on all the specified questions
  await QuestionModel.updateMany(
    {
      _id: { $in: ids },
      user: userId,
    },
    {
      isDeleted: true,
    }
  )

  // if the question has not been used anywhere, perform hard deletion
  /* if (question.instances.length === 0) {
    // TODO: implement hard deletion
    // need to account for tags that are no longer needed etc.
    return 'DELETION_SUCCESSFUL'
  } */

  return 'DELETION_SUCCESSFUL'
}

async function exportQuestions({ ids, userId }) {
  const questions = await QuestionModel.find({ _id: { $in: ids }, user: userId }).populate(['tags', 'versions.files'])
  return questions.map((question) => {
    const latestVersion = question.versions[question.versions.length - 1]
    return {
      title: question.title,
      type: question.type,
      tags: question.tags,
      content: latestVersion.content,
      description: latestVersion.description,
      options: latestVersion.options,
      solution: latestVersion.solution,
      files: latestVersion.files.map((file) => ({
        name: file.name,
        description: file.description,
        type: file.type,
      })),
    }
  })
}

module.exports = {
  createQuestion,
  modifyQuestion,
  archiveQuestions,
  deleteQuestions,
  exportQuestions,
}
