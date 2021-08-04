const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

const File = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['image/png', 'image/jpeg', 'image/gif'],
      required: true,
      index: true,
    },
    description: {
      type: String,
    },

    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

module.exports = {
  FileModel: mongoose.model('File', File),
}
