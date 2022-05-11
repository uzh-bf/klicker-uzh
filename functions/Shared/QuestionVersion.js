const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const QuestionOptions = require('./QuestionOptions')

const QuestionSolution = new mongoose.Schema({
  SC: [{ type: Boolean }],
  MC: [{ type: Boolean }],
  FREE: { type: String },
  FREE_RANGE: { type: Number },
})

module.exports = new mongoose.Schema(
  {
    // markdown content
    content: { type: String },

    // "text-only" version of the above content
    description: { type: String, required: true },

    // question options and the corresponding solutions
    options: { type: QuestionOptions, required: true },
    solution: { type: QuestionSolution, required: false },

    // the file urls that are associated with this question version
    files: [{ type: ObjectId, ref: 'File' }],

    instances: [{ type: ObjectId, ref: 'QuestionInstance' }],
  },
  { timestamps: true }
)
