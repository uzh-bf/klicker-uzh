/*
This script serves as a migration for the user collection
It converts all emails into their canonical, normalized form
E.g., everything is lowercased, dots are removed from gmail addresses, etc.
*/

require('dotenv').config()

const mongoose = require('mongoose')
const { isEmail, normalizeEmail } = require('validator')

const { UserModel } = require('../../../src/models')

mongoose.Promise = Promise

mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

mongoose.connection
  .once('open', async () => {
    // extract all users from the database
    const users = await UserModel.find({})

    // go through all users
    // update their email with a normalized version
    users
      .filter((user) => isEmail(user.email))
      .forEach(async (user) => {
        const { id, email } = user
        const normalizedEmail = normalizeEmail(email)

        if (email !== normalizedEmail) {
          console.log(`${email} -> ${normalizedEmail}`)
          await UserModel.update({ _id: id }, { $set: { email: normalizedEmail } })
        }
      })
  })
  .on('error', (error) => {
    console.warn('> Warning: ', error)
  })
