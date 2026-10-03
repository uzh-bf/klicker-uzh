import { readFileSync } from 'node:fs'

// Emit only validated scope metadata, one field per line, for the shell launcher.
// Configuration errors deliberately omit file contents and parser diagnostics.
function fields(object, names) {
  if (
    object === null ||
    typeof object !== 'object' ||
    Array.isArray(object) ||
    Object.keys(object).length !== names.length ||
    names.some((name) => !Object.hasOwn(object, name))
  ) {
    throw new Error('Invalid configuration fields')
  }
}

try {
  const config = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  fields(config, ['schemaVersion', 'infisical', 'judge'])
  fields(config.infisical, ['domain', 'projectId', 'environment', 'path'])
  fields(config.judge, ['baseUrlSecret', 'apiKeySecret'])
  if (config.schemaVersion !== 1) throw new Error('Invalid schema version')

  const { domain, projectId, environment, path } = config.infisical
  const { baseUrlSecret, apiKeySecret } = config.judge
  const values = [
    domain,
    projectId,
    environment,
    path,
    baseUrlSecret,
    apiKeySecret,
  ]
  if (
    values.some(
      (value) =>
        typeof value !== 'string' ||
        !value.trim() ||
        value !== value.trim() ||
        /[\p{Cc}<>]/u.test(value)
    )
  ) {
    throw new Error('Invalid configuration value')
  }
  const url = new URL(domain)
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !path.startsWith('/') ||
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(baseUrlSecret) ||
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeySecret)
  ) {
    throw new Error('Invalid scope or secret name')
  }
  process.stdout.write(`${values.join('\n')}\n`)
} catch {
  process.stderr.write(
    'Error: evaluation configuration is missing or invalid; use evaluation/config.example.json with explicit scope and secret names.\n'
  )
  process.exitCode = 1
}
