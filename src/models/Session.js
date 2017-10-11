const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const ConfusionTimestep = require('./ConfusionTimestep')
const Feedback = require('./Feedback')
const QuestionBlock = require('./QuestionBlock')

const Session = new mongoose.Schema({
  name: { type: String, default: Date.now(), index: true },
  // session status (enum) => 0: CREATED, 1: RUNNING, 2: COMPLETED
  status: {
    type: Number,
    default: 0,
    min: 0,
    max: 2,
    index: true,
  },
  settings: {
    isConfusionBarometerActive: { type: Boolean, default: false },
    isFeedbackChannelActive: { type: Boolean, default: false },
    isFeedbackChannelPublic: { type: Boolean, default: false },
  },
  user: { type: ObjectId, ref: 'User', required: true },

  blocks: [QuestionBlock],
  confusionTS: [ConfusionTimestep],
  feedbacks: [Feedback],

  activeInstance: { type: ObjectId, ref: 'QuestionInstance' },

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('Session', Session)
