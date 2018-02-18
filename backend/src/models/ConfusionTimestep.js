const mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  difficulty: {
    type: Number,
    default: 0,
    min: -5,
    max: 5,
  },
  speed: {
    type: Number,
    default: 0,
    min: -5,
    max: 5,
  },

  createdAt: { type: Date, default: Date.now() },
})
