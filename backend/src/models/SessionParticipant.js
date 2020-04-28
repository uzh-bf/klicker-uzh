const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

module.exports = new mongoose.Schema({
  // the session that the participant belongs to
  session: { type: ObjectId, ref: 'Session', required: true },

  // the credentials of the participant
  username: { type: String, required: true },
  password: { type: String, required: true },

  // the shibRef of the participant (e.g., AAI email)
  shibRef: { type: String },
})
