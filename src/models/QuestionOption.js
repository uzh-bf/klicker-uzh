const mongoose = require('mongoose')

const QuestionOption = new mongoose.Schema({
  correct: { type: Boolean, required: true },
  name: { type: String, required: false },
})

module.exports = QuestionOption
