const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const User = new mongoose.Schema({
  // define email as unique (not a validator, only for index)
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  password: { type: String, required: true },
  shortname: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 8,
    index: true,
    unique: true,
  },
  institution: {
    type: String,
    required: true,
  },
  useCase: {
    type: String,
  },
  isActive: { type: Boolean, default: false },
  isAAI: { type: Boolean, default: false },
  isMigrated: { type: Boolean, default: false },

  tags: [{ type: ObjectId, ref: 'Tag' }],
  questions: [{ type: ObjectId, ref: 'Question' }],
  sessions: [{ type: ObjectId, ref: 'Session' }],

  runningSession: { type: ObjectId, ref: 'Session' },

  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('User', User)
