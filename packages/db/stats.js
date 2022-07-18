require('dotenv').config()

const mongoose = require('mongoose')
const fs = require('fs')

const { UserModel, SessionModel } = require('.')

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
  console.log(mongoose.connection.readyState)

  const allSessions = await SessionModel.find({
    startedAt: {
      $gte: new Date('2020-01-01'),
    },
  }).populate(['user', 'blocks.instances'])

  console.log(allSessions[allSessions.length - 50])

  const sessions = allSessions
    .filter((session) => !session.name.includes('Demosession'))
    .map((session) => ({
      org: session.user.email.includes('@bf.uzh.ch')
        ? 'BF'
        : session.user.email.includes('uzh.ch')
        ? 'UZH'
        : 'EXT',
      user: session.user.email,

      id: session.id,
      session: session.name,
      status: session.status,

      blocks: session.blocks.length,
      blocksExecuted: session.activeBlock + 1,
      participantsMax: session.blocks
        .flatMap((block) =>
          block.instances.filter((instance) => instance.results)
        )
        .reduce((acc, instance) => {
          return instance.results.totalParticipants > acc
            ? instance.results.totalParticipants
            : acc
        }, 0),
      // participantsAvg: session.blocks
      //   .flatMap((block) => block.instances)
      //   .reduce(
      //     (acc, instance) => {
      //       return {
      //         count: acc.count + instance.results.totalParticipants,
      //         sum: acc.sum + instance.results.totalParticipants,
      //       }
      //     },
      //     { count: 0, sum: 0 }
      //   ),

      feedbacks: session.feedbacks.length,
      resolved: session.feedbacks.reduce((acc, fb) => acc + fb.resolved, 0),
      published: session.feedbacks.reduce((acc, fb) => acc + fb.published, 0),
      pinned: session.feedbacks.reduce((acc, fb) => acc + fb.pinned, 0),
      votes: session.feedbacks.reduce((acc, fb) => acc + fb.votes, 0),
      responses: session.feedbacks.reduce(
        (acc, fb) => acc + fb.responses.length,
        0
      ),
      positiveReactions: session.feedbacks.reduce(
        (acc, fb) =>
          acc +
          fb.responses.reduce(
            (acc, response) => acc + response.positiveReactions,
            0
          ),
        0
      ),
      negativeReactions: session.feedbacks.reduce(
        (acc, fb) =>
          acc +
          fb.responses.reduce(
            (acc, response) => acc + response.negativeReactions,
            0
          ),
        0
      ),

      confusionTS: session.confusionTS.length,
      fast: session.confusionTS.filter((ts) => ts.speed > 0).length,
      slow: session.confusionTS.filter((ts) => ts.speed < 0).length,
      hard: session.confusionTS.filter((ts) => ts.difficulty > 0).length,
      easy: session.confusionTS.filter((ts) => ts.difficulty < 0).length,

      startedAt: session.startedAt,
      finishedAt: session.finishedAt ?? '',
    }))

  fs.writeFile('sessions.json', JSON.stringify(sessions), function (err) {
    if (err) {
      return console.log(err)
    }
  })

  mongoose.disconnect()
})
