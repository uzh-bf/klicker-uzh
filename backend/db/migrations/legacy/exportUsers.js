require('dotenv').config()

const mongoose = require('mongoose')
const { UserModel } = require('../../../src/models')

mongoose.Promise = Promise

mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

mongoose.connection
  .once('open', async () => {
    const users = await UserModel.find({ createdAt: { $gt: new Date('2019-09-01') } })
    users.map((user) => console.log(`${user.email};${user.institution};${user.lastLoginAt};${user.createdAt}`))
    mongoose.connection.close()
  })

  .on('error', (error) => {
    console.warn('> Warning: ', error)
  })
