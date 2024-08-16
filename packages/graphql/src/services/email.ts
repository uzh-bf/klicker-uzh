import fs from 'fs'
import { createRequire } from 'module'
import nodemailer from 'nodemailer'

const require = createRequire(import.meta.url)

type AVAILABLE_EMAIL_TEMPLATES =
  | 'MagicLinkRequested'
  | 'ParticipantAccountActivation'

let transport: nodemailer.Transporter | undefined

export async function createTransport() {
  if (transport) {
    return transport
  }

  if (process.env.EMAIL_TYPE === 'OAUTH') {
    // TODO: add OAuth2 for Outlook 365
  } else {
    transport = nodemailer.createTransport({
      pool: true,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT
        ? parseInt(process.env.EMAIL_PORT)
        : undefined,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    await transport.verify()

    console.log('Email transport verified')
  }

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

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text: string
  html: string
}) {
  const transport = await createTransport()

  if (!transport) return false

  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  })

  return true
}
