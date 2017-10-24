const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const Response = new mongoose.Schema({
  ip: { type: String, default: 'none' },
  fingerprint: { type: String, default: 'none' },
  value: { type: Object, required: true },

  createdAt: { type: Date, default: Date.now() },
})

const Results = new mongoose.Schema({
  choices: [{ type: Number }],
  free: { type: Object },

  createdAt: { type: Date, default: Date.now() },
})

const QuestionInstance = new mongoose.Schema({
  isOpen: { type: Boolean, default: false },

  question: { type: ObjectId, ref: 'Question', required: true },
  user: { type: ObjectId, ref: 'User', required: true },
  version: { type: Number, min: 0, required: true },

  responses: [{ type: Response }],
  results: { type: Results },

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('QuestionInstance', QuestionInstance)
