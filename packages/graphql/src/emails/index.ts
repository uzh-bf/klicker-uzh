import { buildSendMail } from 'mailing-core'
import nodemailer from 'nodemailer'

// TODO: replace with OAuth2 for Outlook 365
const transport = nodemailer.createTransport({
  pool: true,
  host: 'localhost',
  port: 1025,
  secure: false, // use TLS
  auth: {
    user: 'username',
    pass: 'password',
  },
})

// const transport = nodemailer.createTransport({
//   pool: true,
//   host: 'smtp.office365.com',
//   port: 587,
//   secure: false,
//   auth: {
//     type: 'OAuth2',
//     clientId: AZURE_CLIENT_ID,
//     clientSecret: AZURE_CLIENT_SECRET,
//     tenantId: AZURE_TENANT_ID,
//     user: 'user@example.com',
//     refreshToken: REFRESH_TOKEN,
//   },
// })

const sendMail = buildSendMail({
  transport,
  defaultFrom: 'Team KlickerUZH <noreply-klicker@df.uzh.ch>',
  configPath: './mailing.config.json',
})

export default sendMail
