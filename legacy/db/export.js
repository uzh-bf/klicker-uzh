const mongoose = require('mongoose')
const fs = require('fs')

const { UserModel, QuestionModel, TagModel } = require('.')

mongoose.Promise = Promise

mongoose.connect(process.env.DATABASE_URL_LEGACY, {
  auth: {
    user: process.env.DATABASE_USER_LEGACY,
    password: process.env.DATABASE_PASS_LEGACY,
  },
  useUnifiedTopology: true,
  useNewUrlParser: true,
})

mongoose.connection.once('open', async () => {
  console.log(mongoose.connection.readyState)

  const user = await UserModel.findOne({
    email: process.env.DATABASE_EXPORT_USER,
  })

  const questions = await QuestionModel.find({
    user: user._id,
    isDeleted: false,
    isArchived: false,
  }).populate([
    {
      path: 'tags',
      select: {
        name: 1,
      },
    },
    { path: 'files' },
  ])

  console.log(user)
  console.log(questions)

  const myData = JSON.stringify(questions)

  fs.writeFile('exported_questions.json', myData, function (err) {
    if (err) {
      return console.log(err)
    }
  })

  mongoose.disconnect()
})
