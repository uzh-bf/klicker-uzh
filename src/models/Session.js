const mongoose = require('mongoose')
const _values = require('lodash/values')

const { ObjectId } = mongoose.Schema.Types

const Feedback = require('./Feedback')
const ConfusionTimestep = require('./ConfusionTimestep')
const SessionParticipant = require('./SessionParticipant')
const { QuestionBlock } = require('./QuestionBlock')
const { SESSION_STATUS, SESSION_STORAGE_MODE } = require('../constants')

const Session = new mongoose.Schema(
  {
    name: { type: String, default: Date.now(), index: true },
    status: {
      type: String,
      enum: _values(SESSION_STATUS),
      default: SESSION_STATUS.CREATED,
      index: true,
    },
    settings: {
      isParticipantAuthenticationEnabled: { type: Boolean, default: false },
      isConfusionBarometerActive: { type: Boolean, default: false },
      isEvaluationPublic: { type: Boolean, default: false },
      isFeedbackChannelActive: { type: Boolean, default: false },
      isFeedbackChannelPublic: { type: Boolean, default: false },
      storageMode: { type: String, enum: _values(SESSION_STORAGE_MODE), default: SESSION_STORAGE_MODE.SECRET },
    },
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    blocks: [{ type: QuestionBlock, required: true }],
    confusionTS: [ConfusionTimestep],
    feedbacks: [Feedback],

    execution: { type: Number, default: 0 },
    activeBlock: { type: Number, default: -1 },
    activeStep: { type: Number, default: 0 },
    activeInstances: [{ type: ObjectId, ref: 'QuestionInstance' }],
    participants: [{ type: SessionParticipant }],

    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
)

module.exports = {
  SessionModel: mongoose.model('Session', Session),
}
