const mongoose = require('mongoose')

const Response = new mongoose.Schema({
  key: { type: Number, min: 0, required: true },
  value: { type: Object, required: true },

  createdAt: { type: Date, default: Date.now() },
})

module.exports = Response
