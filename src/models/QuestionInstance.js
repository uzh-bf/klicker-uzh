const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const QuestionInstance = new mongoose.Schema({
  question: { type: ObjectId, required: true, ref: 'Question' },
  user: { type: ObjectId, ref: 'User' },
  version: { type: Number, required: true, min: 0 },

  responses: [{ type: Object }],

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('QuestionInstance', QuestionInstance)
