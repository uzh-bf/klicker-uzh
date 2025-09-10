import { HatchetClient, Priority } from '@hatchet-dev/typescript-sdk'

export type SimpleInput = {}

export function prepareHatchetTasks(hatchet: HatchetClient) {
  const createAuditLogEntryTask = hatchet.durableTask({
    name: 'create-audit-log-entry',
    retries: 3,
    defaultPriority: Priority.MEDIUM,
    onEvents: ['create-audit-log-entry'],
    fn: (message: Record<string, string | undefined>, ctx) => {
      // TODO: implement audit log functionality beyond logging here
      ctx.logger.info(`Audit log entry: ${JSON.stringify(message)}`)
    },
  })

  return [createAuditLogEntryTask]
}
