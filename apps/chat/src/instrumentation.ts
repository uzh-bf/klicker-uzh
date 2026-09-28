export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const [{ getChatModelRegistry }, { registerLangfuseTelemetry }] =
    await Promise.all([
      import('./lib/server/chatModelRegistry'),
      import('./lib/server/langfuseTracing'),
    ])

  const { logger } = await import('./lib/server/logger')
  logger.info({ event: 'service.started' }, 'Chat service started')

  getChatModelRegistry()
  await registerLangfuseTelemetry()
}
