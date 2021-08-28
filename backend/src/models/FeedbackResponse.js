const mongoose = require('mongoose')

module.exports = new mongoose.Schema(
  {
    content: { type: String, required: true },
    positiveReactions: { type: Number, default: 0 },
    negativeReactions: { type: Number, default: 0 },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
)
