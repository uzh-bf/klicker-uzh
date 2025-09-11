import { HatchetClient, Priority } from '@hatchet-dev/typescript-sdk'

export function prepareHatchetTasks(hatchet: HatchetClient) {
  const createAuditLogEntryTask = hatchet.task({
    name: 'create-audit-log-entry',
    retries: 3,
    defaultPriority: Priority.LOW,
    onEvents: ['create-audit-log-entry'],
    fn: (
      message: Record<string, string | undefined> & {
        correlationId: string
        info: string
      },
      ctx
    ) => {
      const { info, ...args } = message

      // TODO: send the message to the actual audit log service with the correlation ID as a key?
      ctx.logger.info(`Audit log entry: ${info}`, args)
    },
  })

  return [createAuditLogEntryTask]
}
