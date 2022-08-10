require('dotenv').config()

const mongoose = require('mongoose')
const _flatMap = require('lodash/flatMap')

const { SessionModel, QuestionInstanceModel, UserModel } = require('../../../src/models')

mongoose.Promise = Promise

mongoose.connect(`mongodb://klicker:klicker@localhost:27017/klicker?authSource=klicker`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

mongoose.connection
  .once('open', async () => {
    const users = await UserModel.find({})

    await Promise.all(
      users.map((user) =>
        Promise.all(
          user.sessions.map(async (sessionId) => {
            const session = await SessionModel.findById(sessionId)

            const promises = _flatMap(session.blocks, (block) =>
              block.instances.map(async (instanceId) => {
                const instance = await QuestionInstanceModel.findById(instanceId)

                if (session.id.toString() !== instance.session.toString()) {
                  console.log(`${user.email} - ID mismatch ${session.id} ${instance.session}`)
                  instance.session = session.id
                  await instance.save()
                }
              })
            )

            return Promise.all(promises)
          })
        )
      )
    )

    mongoose.connection.close()
  })

  .on('error', (error) => {
    console.warn('> Warning: ', error)
  })
