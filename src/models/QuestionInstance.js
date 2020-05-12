const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const Response = new mongoose.Schema(
  {
    participant: { type: String, ref: 'SessionParticipant' },
    value: { type: Object, required: true },
  },
  { timestamps: true }
)

const Results = new mongoose.Schema(
  {
    CHOICES: [{ type: Number }],
    FREE: { type: Object },

    totalParticipants: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const QuestionInstance = new mongoose.Schema(
  {
    isOpen: { type: Boolean, default: false },

    question: {
      type: ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    session: {
      type: ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    version: { type: Number, min: 0, required: true },

    // the participants that are blocked for further votes
    // in case the session is paused, we need to persist who is still allowed to vote
    blockedParticipants: [{ type: String }],

    // all the responses that have been received
    // this will only be used when the session storage mode is set to complete
    responses: [{ type: Response }],
    dropped: [{ type: Response }],

    // the results that have been aggregated for this instance
    results: { type: Results },
  },
  { timestamps: true }
)

module.exports = mongoose.model('QuestionInstance', QuestionInstance)
