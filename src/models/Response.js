const mongoose = require('mongoose')

module.exports = new mongoose.Schema({
  value: { type: Object, required: true },

  createdAt: { type: Date, default: Date.now() },
})
