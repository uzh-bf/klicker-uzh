import { spawnSync } from 'node:child_process'
import { accessSync, constants, realpathSync, statSync } from 'node:fs'
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path'

function isHostExecutable(path) {
  if (!isAbsolute(path)) return false
  try {
    // pnpm prepends workspace bins, including bins from ancestor checkouts.
    for (const directory of [dirname(path), realpathSync(dirname(path))]) {
      if (directory.split(/[\\/]/).includes('node_modules')) return false
    }
    accessSync(path, constants.X_OK)
    return statSync(path).isFile()
  } catch {
    return false
  }
}

export function resolveDevrouter({ repo, env = process.env, executable } = {}) {
  const override = executable ?? env.KLICKER_DEVROUTER_BIN
  const candidates = override
    ? [override]
    : (env.PATH ?? '')
        .split(delimiter)
        .filter(isAbsolute)
        .map((directory) => join(directory, 'devrouter'))
  const binary = candidates.find(isHostExecutable)
  if (!binary) {
    throw new Error(
      'No executable host Devrouter found. Install it on the host and set KLICKER_DEVROUTER_BIN to its absolute path if needed; workspace node_modules binaries are excluded.'
    )
  }

  const result = spawnSync(binary, ['-V', '--repo', resolve(repo)], {
    cwd: repo,
    env,
    encoding: 'utf8',
    timeout: 10000,
  })
  if (result.error || result.status !== 0) {
    throw new Error(
      `Devrouter version check failed for ${binary}: ${result.error?.message ?? result.stderr.trim()}`
    )
  }
  const installed = result.stdout.match(
    /^Installed CLI version: (\d+\.\d+\.\d+)$/m
  )?.[1]
  const required = result.stdout.match(
    /^Local repo version \(.+\): (\d+\.\d+\.\d+)$/m
  )?.[1]
  if (!installed || !required) {
    throw new Error(
      `Cannot determine installed and required Devrouter versions from ${binary}`
    )
  }
  const current = installed.split('.').map(Number)
  const minimum = required.split('.').map(Number)
  const difference =
    current
      .map((part, index) => part - minimum[index])
      .find((part) => part !== 0) ?? 0
  console.error(
    `[devrouter] ${binary}: installed ${installed}, required >=${required}`
  )
  if (difference < 0) {
    throw new Error(
      `Host Devrouter ${binary} is too old. Upgrade that installation to ${required} or newer, or set KLICKER_DEVROUTER_BIN to the intended host executable.`
    )
  }
  return binary
}
