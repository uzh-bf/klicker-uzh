import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import * as EmailService from './email.js'

// Fixed recipient and subject are intentionally hard-coded to keep the request
// flow auditable and prevent arbitrary-recipient abuse through this endpoint.
const SUPPORT_EMAIL = 'klicker@df.uzh.ch'
const SUPPORT_SUBJECT = 'KlickerUZH Catalyst Access Request'

export async function requestCatalystAccess(
  args: {
    institution: string
    useCase: string
  },
  ctx: ContextWithUser
) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    select: { id: true, email: true, firstName: true, lastName: true },
  })

  if (!user?.email) {
    throw new GraphQLError('Unauthorized', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  // Escape HTML-sensitive characters before embedding trimmed user input into
  // the email body. The plain-text variant uses the raw trimmed values.
  const escapeHtml = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')

  const institution = args.institution.trim().slice(0, 160)
  const useCase = args.useCase.trim().slice(0, 2000)
  const safeInstitution = escapeHtml(institution)
  const safeUseCase = escapeHtml(useCase)

  const html = [
    '<p>A KlickerUZH user has requested Catalyst access:</p>',
    `<p><strong>Name:</strong> ${escapeHtml(user.firstName ?? '')} ${escapeHtml(user.lastName ?? '')}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(user.email)}</p>`,
    `<p><strong>Institution:</strong> ${safeInstitution}</p>`,
    `<p><strong>Intended use:</strong></p><p>${safeUseCase.replace(/\n/g, '<br />')}</p>`,
  ].join('\n')

  const text = [
    'A KlickerUZH user has requested Catalyst access:',
    `Name: ${user.firstName ?? ''} ${user.lastName ?? ''}`,
    `Email: ${user.email}`,
    `Institution: ${institution}`,
    `Intended use: ${useCase}`,
  ].join('\n')

  const sent = await EmailService.sendEmail({
    to: SUPPORT_EMAIL,
    subject: SUPPORT_SUBJECT,
    text,
    html,
    replyTo: user.email,
  })

  if (!sent) {
    console.error('Failed to send Catalyst access request')
    throw new GraphQLError('Internal server error', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    })
  }

  return true
}
