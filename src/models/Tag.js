const mongoose = require('mongoose')

const ObjectId = mongoose.Schema.Types.ObjectId

const Tag = new mongoose.Schema({
  name: { type: String, required: true, index: true },

  questions: [{ type: ObjectId, ref: 'Question' }],

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('Tag', Tag)
