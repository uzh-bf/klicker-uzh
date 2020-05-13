/* eslint-disable */
/*
  This is a template for a migration script
*/

require('dotenv').config()

const mongoose = require('mongoose')

const models = require('../../src/models')

mongoose.Promise = Promise

mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

function migrate(entity) {
  // TODO: return promise for the migrated entity
}

mongoose.connection
  .once('open', async () => {
    // TODO: perform migration operations
  })
  .on('error', (error) => {
    console.warn('> Warning: ', error)
  })
