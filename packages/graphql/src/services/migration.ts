import axios from 'axios'
import JWT from 'jsonwebtoken'
import normalizeEmail from 'validator/es/lib/normalizeEmail'

import { ServiceBusClient } from '@azure/service-bus'
import { ContextWithUser } from 'src/lib/context'
import getMongoDB from 'src/lib/mongo'
import {
  sendEmailMigrationNotification,
  sendTeamsNotifications,
} from '../lib/util'

interface RequestMigrationTokenArgs {
  email: string
}

export async function requestMigrationToken(
  args: RequestMigrationTokenArgs,
  ctx: ContextWithUser
) {
  const userData = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
  })

  if (!userData) return false

  const db = await getMongoDB()

  // we used normalization for emails in the old KlickerUZH
  // if they enter the email address unnormalized, we still want to try matching against the normalized version
  const matchingUsers = await db
    .collection('users')
    .find({ email: args.email.toLowerCase() })
    .toArray()

  const matchingUsersNormalized = await db
    .collection('users')
    .find({ email: normalizeEmail(args.email) })
    .toArray()

  const oldEmail =
    matchingUsers?.[0]?.email ?? matchingUsersNormalized?.[0]?.email

  if (!oldEmail) {
    await sendEmailMigrationNotification(
      args.email,
      process.env.LISTMONK_TEMPLATE_MIGRATION_EMAIL_NOT_AVAILABLE as string
    )

    throw new Error(`No matching V2 user found for ${args.email}`)
  }

  const migrationToken = JWT.sign(
    {
      sub: ctx.user.sub,
      originalEmail: oldEmail,
    },
    process.env.MIGRATION_SECRET as string,
    {
      expiresIn: '7d',
    }
  )

  const migrationLink = `https://manage${
    process.env.COOKIE_DOMAIN
  }/migration?token=${encodeURIComponent(migrationToken)}`

  console.log(migrationLink)

  await sendTeamsNotifications(
    'graphql/migration',
    `[${process.env.NODE_ENV}] Migration Requested for E-Mail ${oldEmail} in v2 with Edu-ID ${userData.email} (v3), Link: ${migrationLink}`
  )

  const LISTMONK_AUTH = {
    username: process.env.LISTMONK_USER as string,
    password: process.env.LISTMONK_PASS as string,
  }

  try {
    // add the user as a subscriber to enable sending emails via listmonk
    await axios.post(
      `${process.env.LISTMONK_URL}/api/subscribers`,
      {
        email: oldEmail,
        name: oldEmail,
        status: 'enabled',
        preconfirm_subscriptions: true,
      },
      { auth: LISTMONK_AUTH }
    )
  } catch (e: any) {
    if (e.response.status !== 409) {
      console.error(e)
      return false
    }
  }

  try {
    // send the migration link via email
    await axios.post(
      `${process.env.LISTMONK_URL}/api/tx`,
      {
        subscriber_emails: [oldEmail],
        template_id: Number(process.env.LISTMONK_TEMPLATE_MIGRATION_REQUEST),
        data: { migrationLink, newAccountEmail: userData.email },
      },
      { auth: LISTMONK_AUTH }
    )
  } catch (e) {
    console.error(e)
    return false
  }

  return true
}

interface TriggerMigrationArgs {
  token: string
}

export async function triggerMigration(
  args: TriggerMigrationArgs,
  ctx: ContextWithUser
) {
  try {
    const token = JWT.verify(
      args.token,
      process.env.MIGRATION_SECRET as string
    ) as {
      sub: string
      originalEmail: string
    }

    if (!token) return false

    // if the user generating the token is not the same as the user currently logged in, exit
    if (token.sub !== ctx.user.sub) return false

    const user = await ctx.prisma.user.findUnique({
      where: {
        id: token.sub,
      },
    })

    if (!user) return false

    // create an azure service bus connection to post the migration message for further processing with azure functions
    const sb = new ServiceBusClient(
      process.env.MIGRATION_SERVICE_BUS_CONNECTION_STRING as string,
      {}
    )

    const sbSender = sb.createSender(
      process.env.MIGRATION_SERVICE_BUS_QUEUE_NAME as string
    )

    await sbSender.sendMessages({
      messageId: token.sub,
      subject: 'migration',
      body: {
        newUserId: token.sub,
        newEmail: user.email,
        originalEmail: token.originalEmail,
      },
    })

    console.log('migration message posted to service bus')

    return true
  } catch (e) {
    console.error(e)
    return false
  }
}
