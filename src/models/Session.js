const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const ConfusionTimestep = require('./ConfusionTimestep')
const Feedback = require('./Feedback')
const QuestionBlock = require('./QuestionBlock')

const Session = new mongoose.Schema({
  name: { type: String, default: Date.now(), index: true },
  status: {
    type: String,
    enum: ['CREATED', 'RUNNING', 'COMPLETED'],
    default: 'CREATED',
    index: true,
  },
  settings: {
    isConfusionBarometerActive: { type: Boolean, default: false },
    isFeedbackChannelActive: { type: Boolean, default: false },
    isFeedbackChannelPublic: { type: Boolean, default: false },
  },
  user: { type: ObjectId, ref: 'User', required: true },

  blocks: [{ type: QuestionBlock, required: true }],
  confusionTS: [ConfusionTimestep],
  feedbacks: [Feedback],

  activeInstance: { type: ObjectId, ref: 'QuestionInstance' },

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('Session', Session)
