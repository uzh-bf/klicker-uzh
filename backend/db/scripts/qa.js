require('dotenv').config()

const mongoose = require('mongoose')
const fs = require('fs')

const { UserModel, SessionModel } = require('../../src/models')

mongoose.Promise = Promise

mongoose.connect(process.env.MONGO_URL, {
  auth: {
    user: process.env.MONGO_USER,
    password: process.env.MONGO_PASS,
  },
  useUnifiedTopology: true,
  useNewUrlParser: true,
})

mongoose.connection.once('open', async () => {
  // const sessions = await SessionModel.find({})
  // console.log(sessions)

  console.log(mongoose.connection.readyState)

  const sessionsWithFeedbacks = await SessionModel.find({
    startedAt: {
      $gte: new Date('2021-09-01'),
    },
    feedbacks: {
      $elemMatch: {
        $exists: true,
        // $elemMatch: {
        //   responses: {
        //     $exists: true,
        //   },
        // },
      },
    },
  }).populate(['user'])

  const filtered = sessionsWithFeedbacks
    .filter((session) => session.feedbacks.length >= 3)
    .map((session) => ({
      user: session.user.email,
      session: session.name,
      // feedbacks: session.feedbacks.map((feedback) => ({
      //   content: feedback.content,
      //   votes: feedback.votes,
      //   resolved: feedback.resolved,
      //   pinned: feedback.pinned,
      //   published: feedback.published,
      //   responseCount: feedback.responses.count,
      //   responses: feedback.responses.map((response) => ({
      //     content: response.content,
      //     positiveReactions: response.positiveReactions,
      //     negativeReactions: response.negativeReactions,
      //   })),
      // })),
      // aggregate: {
      feedbacks: session.feedbacks.length,
      resolved: session.feedbacks.reduce((acc, fb) => acc + fb.resolved, 0),
      published: session.feedbacks.reduce((acc, fb) => acc + fb.published, 0),
      pinned: session.feedbacks.reduce((acc, fb) => acc + fb.pinned, 0),
      votes: session.feedbacks.reduce((acc, fb) => acc + fb.votes, 0),
      responses: session.feedbacks.reduce((acc, fb) => acc + fb.responses.length, 0),
      positiveReactions: session.feedbacks.reduce(
        (acc, fb) => acc + fb.responses.reduce((acc, response) => acc + response.positiveReactions, 0),
        0
      ),
      negativeReactions: session.feedbacks.reduce(
        (acc, fb) => acc + fb.responses.reduce((acc, response) => acc + response.negativeReactions, 0),
        0
      ),
      // },
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
    }))

  const myData = JSON.stringify(filtered)

  fs.writeFile('data.json', myData, function (err) {
    if (err) {
      return console.log(err)
    }
  })

  mongoose.disconnect()
})
