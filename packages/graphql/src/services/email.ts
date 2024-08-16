import nodemailer from 'nodemailer'
import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)

type AVAILABLE_EMAIL_TEMPLATES =
  | 'MagicLinkRequested'
  | 'ParticipantAccountActivation'

let transport: nodemailer.Transporter | undefined

export async function createTransport() {
  if (transport) {
    return transport
  }

  // TODO: replace with OAuth2 for Outlook 365
  transport = nodemailer.createTransport({
    pool: true,
    host: 'localhost',
    port: 1025,
    secure: false, // use TLS
    auth: {
      user: 'username',
      pass: 'password',
    },
  })

  await transport.verify()

  return transport
}

export function hydrateTemplate({
  templateName,
  variables = {},
}: {
  templateName: AVAILABLE_EMAIL_TEMPLATES
  variables?: Record<string, string>
}) {
  let template = fs.readFileSync(
    require.resolve(`@klicker-uzh/transactional/out/${templateName}.html`),
    'utf8'
  )

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`[${key}]`, value)
  }

  return template
}

export async function sendEmail({ to, subject, text, html }) {
  const transport = await createTransport()

  await transport.sendMail({
    from:
      process.env.EMAIL_FROM ?? '"Team KlickerUZH" <noreply-klicker@df.uzh.ch>',
    to,
    subject,
    text,
    html,
  })

  return true
}
