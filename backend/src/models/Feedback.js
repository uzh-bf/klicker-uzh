const mongoose = require('mongoose')

const FeedbackResponse = require('./FeedbackResponse')

module.exports = new mongoose.Schema(
  {
    published: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    resolved: { type: Boolean, default: false },
    content: { type: String, required: true },
    votes: { type: Number, default: 0, min: 0 },
    responses: [{ type: FeedbackResponse }],
  },
  { timestamps: true }
)
