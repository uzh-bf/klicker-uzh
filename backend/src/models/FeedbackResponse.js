const mongoose = require('mongoose')

module.exports = new mongoose.Schema(
  {
    content: { type: String, required: true },
  },
  { timestamps: true }
)
