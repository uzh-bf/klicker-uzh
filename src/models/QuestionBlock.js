const mongoose = require('mongoose')
const _values = require('lodash/values')

const { ObjectId } = mongoose.Schema.Types

const { QUESTION_BLOCK_STATUS } = require('../constants')

module.exports = {
  QuestionBlock: new mongoose.Schema(
    {
      status: {
        type: String,
        enum: _values(QUESTION_BLOCK_STATUS),
        default: QUESTION_BLOCK_STATUS.PLANNED,
      },
      timeLimit: { type: Number, default: -1, min: -1 },
      showSolutions: { type: Boolean, default: false },

      instances: [{ type: ObjectId, ref: 'QuestionInstance', required: true }],
    },
    { timestamps: true }
  ),
}
