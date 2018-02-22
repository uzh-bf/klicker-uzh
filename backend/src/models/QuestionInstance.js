const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const Response = new mongoose.Schema({
  ipUnique: { type: Boolean },
  fpUnique: { type: Boolean },
  value: { type: Object, required: true },

  createdAt: { type: Date, default: Date.now() },
})

const Results = new mongoose.Schema({
  CHOICES: [{ type: Number }],
  FREE: { type: Object },

  totalParticipants: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now() },
})

const QuestionInstance = new mongoose.Schema({
  isOpen: { type: Boolean, default: false },

  question: {
    type: ObjectId,
    ref: 'Question',
    required: true,
    index: true,
  },
  session: {
    type: ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  user: {
    type: ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  version: { type: Number, min: 0, required: true },

  responses: [{ type: Response }],
  results: { type: Results },

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('QuestionInstance', QuestionInstance)
