export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('./lib/server/logger')
    logger.info({ event: 'service.started' }, 'Participant frontend started')
  }
}
