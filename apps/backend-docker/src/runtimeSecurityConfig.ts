export function shouldMaskGraphqlErrors(env: NodeJS.ProcessEnv = process.env) {
  const localRuntime = env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
  if (!localRuntime) return true

  const debug = env.DEBUG
  if (typeof debug === 'undefined' || debug === 'false') return true
  if (debug === 'true') return false
  throw new Error('DEBUG must be either "true" or "false" when configured.')
}

export function getImportExportManageOriginForStartup({
  userOperations,
  env = process.env,
}: {
  userOperations: boolean
  env?: NodeJS.ProcessEnv
}) {
  if (!userOperations) return undefined

  const value = env.APP_ORIGIN_MANAGE
  if (!value || value.trim() !== value) {
    throw new Error(
      'APP_ORIGIN_MANAGE must be configured as the canonical manage origin when import/export is enabled.'
    )
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(
      'APP_ORIGIN_MANAGE must be configured as the canonical manage origin when import/export is enabled.'
    )
  }

  const localRuntime = env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
  const allowedProtocol =
    url.protocol === 'https:' || (localRuntime && url.protocol === 'http:')
  if (
    !allowedProtocol ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'APP_ORIGIN_MANAGE must be an HTTPS origin without credentials, path, query, or fragment; HTTP is allowed only in development and test.'
    )
  }

  return url.origin
}
