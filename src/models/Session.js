const mongoose = require('mongoose')
const _values = require('lodash/values')

const { ObjectId } = mongoose.Schema.Types

const Feedback = require('./Feedback')
const ConfusionTimestep = require('./ConfusionTimestep')
const { QuestionBlock } = require('./QuestionBlock')

const SessionStatus = {
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
}

const Session = new mongoose.Schema({
  name: { type: String, default: Date.now(), index: true },
  status: {
    type: String,
    enum: _values(SessionStatus),
    default: SessionStatus.CREATED,
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

  activeBlock: { type: Number, default: -1 },
  activeInstances: [{ type: ObjectId, ref: 'QuestionInstance' }],

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = {
  SessionModel: mongoose.model('Session', Session),
  SessionStatus,
}
