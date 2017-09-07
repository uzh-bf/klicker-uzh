const mongoose = require('mongoose')

const ConfusionTimeStep = new mongoose.Schema({
  comprehensibility: {
    type: Number,
    default: 0,
    min: -50,
    max: 50,
  },
  difficulty: {
    type: Number,
    default: 0,
    min: -50,
    max: 50,
  },

  createdAt: { type: Date, default: Date.now() },
})

module.exports = ConfusionTimeStep
