const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

module.exports = new mongoose.Schema({
  status: {
    type: String,
    enum: ['PLANNED', 'ACTIVE', 'EXECUTED'],
    default: 'PLANNED',
  },
  timeLimit: { type: Number, default: -1, min: -1 },
  showSolutions: { type: Boolean, default: false },

  instances: [{ type: ObjectId, ref: 'QuestionInstance', required: true }],

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})
