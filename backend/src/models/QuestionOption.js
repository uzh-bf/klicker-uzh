const mongoose = require('mongoose')

const QuestionOption = new mongoose.Schema({
  key: { type: Number, min: 0, required: true },
  correct: { type: Boolean, required: true },
  name: { type: String, required: false },
})

module.exports = QuestionOption
