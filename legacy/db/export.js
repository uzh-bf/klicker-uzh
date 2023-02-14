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
    },
    { path: 'versions.files' },
  ])

  const mappedQuestions = questions.map((q) => {
    const lastVersion = q.versions[q.versions.length - 1]
    return {
      id: q.id,
      title: q.title,
      type: q.type,
      tags: q.tags.map((t) => t.name),
      version: {
        content:
          lastVersion.content +
          (lastVersion.files?.length > 0
            ? '\n' +
              lastVersion.files
                .map(
                  (f) =>
                    `![${f.originalName}](https://tc-klicker-prod.s3.amazonaws.com/images/${f.name})`
                )
                .join('\n')
            : ''),
        options: lastVersion.options,
      },
    }
  })

  console.log(user)
  console.log(mappedQuestions)

  const myData = JSON.stringify(mappedQuestions)

  fs.writeFile('exported_questions.json', myData, function (err) {
    if (err) {
      return console.log(err)
    }
  })

  mongoose.disconnect()
})
