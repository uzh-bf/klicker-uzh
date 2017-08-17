// @flow

const mongoose = require('mongoose')

const QuestionSchema = new mongoose.Schema({
  title: String,
})

module.exports = mongoose.model('Question', QuestionSchema)
