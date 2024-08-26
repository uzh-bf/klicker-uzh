import { createRequire } from 'module'
import nodemailer from 'nodemailer'
import { Context } from 'src/lib/context.js'

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
    try {
      transport = nodemailer.createTransport({
        pool: true,
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT
          ? parseInt(process.env.EMAIL_PORT)
          : undefined,
        secure: process.env.EMAIL_SECURE === 'true',
        requireTLS: process.env.EMAIL_STARTTLS === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })

      await transport.verify()

      console.log('Email transport verified')
    } catch (e) {
      console.error('Error creating email transport: ', e)
      return null
    }
  }

  return transport
}

export async function hydrateTemplate(
  {
    templateName,
    variables = {},
  }: {
    templateName: AVAILABLE_EMAIL_TEMPLATES
    variables?: Record<string, string>
  },
  ctx: Context
) {
  let template

  try {
    template = await ctx.prisma.emailTemplate.findUnique({
      where: { name: templateName },
    })

    if (!template) return null

    template = template.html
  } catch (e) {
    console.error('Error reading email template: ', e)
    return null
  }

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

  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    })
  } catch (e) {
    console.error('Error sending email: ', e)
    return false
  }

  return true
}
