import { ContextWithUser } from 'src/lib/context'

export async function requestMigrationToken() {
  // TODO: get user data from the old klicker database
  // TODO: generate a unique JWT with limited lifetime and embedded user data from klicker v2
  // TODO: send the JWT to the user's email
}

interface TriggerMigrationArgs {
  token: string
}

export async function triggerMigration(
  args: TriggerMigrationArgs,
  ctx: ContextWithUser
) {
  // TODO: validate the migration token
  // TODO: trigger the migration process by sending a message to the migration queue
}

// TODO: build an azure function that exports data based on a service bus trigger and drops json on blob storage
// TODO: build an azure function that triggers on blob storage and fills data using import scripts
// TODO: trigger a new email to the user when the migration is complete
