require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const nodemailer = require('nodemailer')
const handlebars = require('handlebars')

const { UserModel } = require('../../src/models')

mongoose.Promise = Promise

mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 1000,
})

const transporter = nodemailer.createTransport({
  host: 'smtp.uzh.ch',
  port: 587,
  secure: false,
  auth: { user: 'klicker.support@uzh.ch', pass: '<REPLACE_PASS>' },
  requiresAuth: true,
  pool: true,
  rateLimit: 50,
  logger: true,
})

const source = fs.readFileSync(path.join(__dirname, `20HS.html`), 'utf8')
const compile = handlebars.compile(source)
const template = compile()

mongoose.connection
  .once('open', async () => {
    const users = await UserModel.find({ lastLoginAt: { $gt: new Date('2019-09-01') } }, 'email')
    const emails = users.map((user) => user.email)

    await Promise.all(
      emails.map(async (email) => {
        try {
          await transporter.sendMail({
            from: 'klicker.support@uzh.ch',
            to: email,
            subject: 'KlickerUZH - Fall Release 2020',
            html: template,
          })

          console.log(`[sent] ${email}`)
        } catch (e) {
          console.log(`[failed] ${email} ${e}`)
        }
      })
    )

    transporter.close()

    mongoose.connection.close()
  })

  .on('error', (error) => {
    console.warn('> Warning: ', error)
  })
