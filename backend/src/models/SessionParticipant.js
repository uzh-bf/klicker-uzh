const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

module.exports = new mongoose.Schema({
  _id: { type: String, required: true },

  // the session that the participant belongs to
  session: { type: ObjectId, ref: 'Session', required: true },

  // the credentials of the participant
  username: { type: String, required: true },
  password: { type: String },
})
