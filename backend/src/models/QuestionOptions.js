const mongoose = require('mongoose')
const _values = require('lodash/values')

const FREERestrictionTypes = {
  NONE: 'NONE',
  RANGE: 'RANGE',
}

// for SC and MC questions, define the choices and related settings
const Choice = new mongoose.Schema({
  correct: { type: Boolean, required: true },
  name: { type: String, required: false },
})

// for FREE questions, define optional restrictions
const Restrictions = new mongoose.Schema({
  min: { type: Number },
  max: { type: Number },
  type: { type: String, enum: _values(FREERestrictionTypes), default: FREERestrictionTypes.NONE },
})

module.exports = {
  QuestionOptions: new mongoose.Schema({
    choices: [{ type: Choice }],
    randomized: { type: Boolean, default: false },
    restrictions: { type: Restrictions },
  }),
  FREERestrictionTypes,
}
