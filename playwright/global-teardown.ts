export default async function globalTeardown() {
  const rawPid = process.env.PLAYWRIGHT_SEMANTIC_EVALUATOR_PID
  if (!rawPid) return

  const pid = Number(rawPid)
  if (!Number.isInteger(pid) || pid <= 0) return

  try {
    process.kill(pid, 'SIGTERM')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
  }
}
