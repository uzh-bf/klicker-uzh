const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const QuestionBlock = new mongoose.Schema({
  key: { type: Number, min: 0, required: true },
  // question block status (enum) => 0: PLANNED, 1: ACTIVE, 2: EXECUTED
  status: {
    type: Number,
    default: 0,
    min: 0,
    max: 2,
  },
  timeLimit: { type: Number, default: -1, min: -1 },
  showSolutions: { type: Boolean, default: false },

  instances: [{ type: ObjectId, ref: 'QuestionInstance' }],

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = QuestionBlock
