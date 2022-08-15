const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const Tag = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    questions: [{ type: ObjectId, ref: 'Question', required: true }],
  },
  { timestamps: true }
)

module.exports = mongoose.model('Tag', Tag)
