import axios from 'axios'
import JWT from 'jsonwebtoken'

import { ServiceBusClient } from '@azure/service-bus'
import { ContextWithUser } from 'src/lib/context'

interface RequestMigrationTokenArgs {
  email: string
}

export async function requestMigrationToken(
  args: RequestMigrationTokenArgs,
  ctx: ContextWithUser
) {
  const migrationToken = JWT.sign(
    {
      sub: ctx.user.sub,
      originalEmail: args.email,
    },
    process.env.MIGRATION_SECRET as string,
    {
      expiresIn: '1d',
    }
  )

  const migrationLink = `http://manage.${
    process.env.COOKIE_DOMAIN
  }/migration?token=${encodeURIComponent(migrationToken)}`

  console.log(migrationLink)

  const LISTMONK_AUTH = {
    username: process.env.LISTMONK_USER as string,
    password: process.env.LISTMONK_PASS as string,
  }

  try {
    // add the user as a subscriber to enable sending emails via listmonk
    await axios.post(
      `${process.env.LISTMONK_URL}/api/subscribers`,
      {
        email: args.email,
        name: args.email,
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
        subscriber_emails: [args.email],
        template_id: 3,
        data: { migrationLink },
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
        originalEmail: token.originalEmail,
        // originalEmail: 'roland.schlaefli@bf.uzh.ch',
      },
    })

    console.log('migration message posted to service bus')

    return true
  } catch (e) {
    console.error(e)
    return false
  }
}

// TODO: build an azure function that exports data based on a service bus trigger and drops json on blob storage
// TODO: build an azure function that triggers on blob storage and fills data using import scripts
// TODO: trigger a new email to the user when the migration is complete
