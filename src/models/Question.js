const mongoose = require('mongoose')

const ObjectId = mongoose.Schema.Types.ObjectId

const QuestionVersion = require('./QuestionVersion')

const Question = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['SC'] },
  user: { type: ObjectId, ref: 'User' },

  versions: [QuestionVersion],
  instances: [{ type: ObjectId, ref: 'QuestionInstance' }],
  tags: [{ type: ObjectId, ref: 'Tag' }],

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('Question', Question)
