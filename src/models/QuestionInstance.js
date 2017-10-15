const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const Response = require('./Response')

const QuestionInstance = new mongoose.Schema({
  question: { type: ObjectId, ref: 'Question', required: true },
  user: { type: ObjectId, ref: 'User', required: true },
  version: { type: Number, min: 0, required: true },

  responses: [{ type: Response }],

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('QuestionInstance', QuestionInstance)
