const mongoose = require('mongoose')

// for SC and MC questions, define the choices and related settings
const Choice = new mongoose.Schema({
  correct: { type: Boolean, required: true },
  name: { type: String, required: false },
})

// for FREE questions, define optional restrictions
const Restrictions = new mongoose.Schema({
  min: { type: Number },
  max: { type: Number },
  // RANGE: numerical range with defined min and/or max values
  type: { type: String, enum: ['NONE', 'RANGE'], default: 'NONE' },
})

module.exports = new mongoose.Schema({
  choices: [{ type: Choice }],
  randomized: { type: Boolean, default: false },
  restrictions: { type: Restrictions },
})
