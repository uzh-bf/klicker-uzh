const mongoose = require('mongoose')
const _values = require('lodash/values')

const { ObjectId } = mongoose.Schema.Types

const { QuestionBlockStatus } = require('../constants')

module.exports = {
  QuestionBlock: new mongoose.Schema({
    status: {
      type: String,
      enum: _values(QuestionBlockStatus),
      default: QuestionBlockStatus.PLANNED,
    },
    timeLimit: { type: Number, default: -1, min: -1 },
    showSolutions: { type: Boolean, default: false },

    instances: [{ type: ObjectId, ref: 'QuestionInstance', required: true }],

    createdAt: { type: Date, default: Date.now() },
    updatedAt: { type: Date, default: Date.now() },
  }),
}
