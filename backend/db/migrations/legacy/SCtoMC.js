/* eslint-disable */

require('dotenv').config()

const mongoose = require('mongoose')

const { QuestionModel, UserModel } = require('../../../src/models')

mongoose.Promise = Promise

mongoose.connect(`mongodb://klicker:klicker@localhost:27017/klicker?authDatabase=klicker`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

mongoose.connection
  .once('open', async () => {
    // extract all users from the database
    const user = await UserModel.findById('5b68c27dccb5dc1eb4b30526')

    const promises = user.questions.map(async (questionId) => {
      const question = await QuestionModel.findById(questionId)

      question.type = 'MC'

      question.versions.forEach((version, index) => {
        version.options.MC = version.options.SC
        version.options.SC = undefined

        version.solution.MC = version.solution.SC
        version.solution.SC = undefined

        question.markModified(`versions.${index}.options`)
        question.markModified(`versions.${index}.solution`)
      })

      return question.save()
    })

    await Promise.all(promises)
  })

  .on('error', (error) => {
    console.warn('> Warning: ', error)
  })
