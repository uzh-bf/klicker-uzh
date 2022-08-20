const mongoose = require('mongoose')
const { isAlphanumeric, isEmail, normalizeEmail } = require('validator')
const _values = require('lodash/values')

const { ObjectId } = mongoose.Schema.Types

const { Errors, ROLES } = require('./constants')

const User = new mongoose.Schema(
  {
    // define email as unique (not a validator, only for index)
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      validate: {
        message: Errors.INVALID_EMAIL,
        validator: isEmail,
      },
    },
    password: { type: String, required: true },
    shortname: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 8,
      index: true,
      unique: true,
      validate: {
        message: Errors.INVALID_SHORTNAME,
        validator: (value) => isAlphanumeric(value),
      },
    },
    institution: {
      type: String,
    },
    useCase: {
      type: String,
    },
    isActive: { type: Boolean, default: false },
    isAAI: { type: Boolean, default: false },
    isMigrated: { type: Boolean, default: false },
    role: { type: String, enum: _values(ROLES), default: ROLES.USER },

    files: [{ type: ObjectId, ref: 'File ' }],
    tags: [{ type: ObjectId, ref: 'Tag' }],
    questions: [{ type: ObjectId, ref: 'Question' }],
    sessions: [{ type: ObjectId, ref: 'Session' }],

    runningSession: { type: ObjectId, ref: 'Session' },

    lastLoginAt: { type: Date },

    deletionToken: { type: String },
    deletionRequestedAt: { type: Date },
  },
  { timestamps: true }
)

User.pre('save', (next) => {
  // ensure the email is properly normalized
  if (this.email) {
    this.email = normalizeEmail(this.email)
  }

  next()
})

User.index({ '$**': 1 })

module.exports = mongoose.model('User', User)
