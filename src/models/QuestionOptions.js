const mongoose = require('mongoose')

// for SC and MC questions, define the choices and related settings
const Choice = new mongoose.Schema({
  correct: { type: Boolean, required: true },
  name: { type: String, required: true },
})

const ChoiceOptions = new mongoose.Schema({
  choices: [{ type: Choice, required: true }],
  randomized: { type: Boolean, default: false },
})

// for FREE_RANGE questions, define optional restrictions
const Restrictions = new mongoose.Schema({
  min: { type: Number },
  max: { type: Number },
})
const RangeRestrictions = new mongoose.Schema({
  restrictions: { type: Restrictions, required: true },
})

module.exports = {
  QuestionOptions: new mongoose.Schema({
    SC: { type: ChoiceOptions },
    MC: { type: ChoiceOptions },
    FREE_RANGE: { type: RangeRestrictions },
  }),
}
