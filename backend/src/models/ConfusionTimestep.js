const mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  difficulty: {
    type: Number,
    default: 0,
    min: -10,
    max: 10,
  },
  speed: {
    type: Number,
    default: 0,
    min: -10,
    max: 10,
  },

  createdAt: { type: Date, default: Date.now() },
})
