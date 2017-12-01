const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const QuestionOptions = require('./QuestionOptions')

const QuestionSolution = new mongoose.Schema({
  SC: [{ type: Boolean }],
  MC: [{ type: Boolean }],
  FREE: { type: String },
  FREE_RANGE: { type: Number },
})

module.exports = new mongoose.Schema({
  description: { type: String, required: true },
  options: { type: QuestionOptions, required: true },
  solution: { type: QuestionSolution, required: false },

  instances: [{ type: ObjectId, ref: 'QuestionInstance' }],

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})
