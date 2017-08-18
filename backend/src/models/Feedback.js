// @flow

const mongoose = require('mongoose')

const Feedback = new mongoose.Schema({
  content: { type: String, required: true },
  votes: { type: Number, default: 0, min: 0 },

  createdAt: { type: Date, default: Date.now() },
})

module.exports = Feedback
