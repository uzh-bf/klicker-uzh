/* eslint-disable */
/*
  This is a template for a migration script
*/

require('dotenv').config()

const mongoose = require('mongoose')

const { QuestionInstanceModel, SessionModel } = require('../../src/models')

mongoose.Promise = Promise

async function resultMigration() {
  const sessions = await legacyConnection.SessionModel.find({})

  sessions
    .filter((session) => session.status === 'COMPLETED')
    .map((session) => {
      session.blocks.map(async (block) => {
        await block.instances
          .map((instanceId) => QuestionInstanceModel.find({ instanceId }))
          .filter((instance) => instance.results === (undefined || null))
          .map(async (instance) => {
            const legacyInstance = legacyInstances.find((legacy_inst) => legacy_inst.id === instance.id)
            if (legacyInstance) {
              if (legacyInstance.results) {
                instance.results = legacyInstance.results // ! check if copying like this works
                await instance.save()
              }
            }
          })
      })
    })
}

const legacyConnection = mongoose.createConnection(`mongodb://${process.env.MONGO_URL_LEGACY}`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

// let legacyInstances = []
// legacyConnection
//   .once('open', async () => {
//     legacyInstances = await QuestionInstanceModel.find({})
//   })
//   .on('error', (error) => {
//     console.warn('> Warning: ', error)
//   })

const newConnection = mongoose.createConnection(`mongodb://${process.env.MONGO_URL}`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

newConnection
  .once('open', async () => {
    await resultMigration()
  })
  .on('error', (error) => {
    console.warn('> Warning: ', error)
  })
