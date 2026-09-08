import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { validateIsolatedConfig } from './isolated-config.mjs'

// A failed setup deliberately retains its claim. It must not be mistaken for
// an unused runtime on the next invocation.
export async function claimPreparation(config, candidateRevision) {
  validateIsolatedConfig(config)
  if (!/^[a-f0-9]{40}$/.test(candidateRevision)) {
    throw new Error('An immutable candidate revision is required.')
  }
  const checkout = config.project.runtimeCheckoutPath
  if ((await realpath(checkout)) !== checkout) {
    throw new Error('Runtime checkout must be canonical.')
  }
  const directory = join(checkout, '.local-kb')
  await mkdir(directory, { mode: 0o700 })
  const identity = {
    candidateRevision,
    configurationDigest: createHash('sha256')
      .update(JSON.stringify(config))
      .digest('hex'),
    sourcePath: checkout,
    project: config.project.identity,
  }
  await writeExclusive(join(directory, 'preparation.json'), identity)
  return identity
}

async function writeExclusive(path, value) {
  const file = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600
  )
  try {
    await file.writeFile(JSON.stringify(value))
    await file.sync()
  } finally {
    await file.close()
  }
}

async function readOwned(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.mode & 0o077) {
      throw new Error(
        'Preparation evidence must be an owner-only regular file.'
      )
    }
    return JSON.parse(await file.readFile('utf8'))
  } finally {
    await file.close()
  }
}

async function verifyClaim(config, candidateRevision) {
  validateIsolatedConfig(config)
  const checkout = config.project.runtimeCheckoutPath
  if ((await realpath(checkout)) !== checkout) {
    throw new Error('Runtime checkout must be canonical.')
  }
  const directory = join(checkout, '.local-kb')
  const stat = await lstat(directory)
  if (
    !stat.isDirectory() ||
    stat.uid !== process.getuid() ||
    stat.mode & 0o077
  ) {
    throw new Error('Preparation directory must be owned and private.')
  }
  const claim = await readOwned(join(directory, 'preparation.json'))
  const expected = {
    candidateRevision,
    configurationDigest: createHash('sha256')
      .update(JSON.stringify(config))
      .digest('hex'),
    sourcePath: checkout,
    project: config.project.identity,
  }
  if (JSON.stringify(claim) !== JSON.stringify(expected)) {
    throw new Error(
      'Preparation identity does not match the requested runtime.'
    )
  }
  return { directory, claim }
}

// Called only after every explicit setup command has succeeded. This receipt
// proves preparation completion, not service health or upstream AI capability.
export async function completePreparation(config, candidateRevision) {
  const { directory, claim } = await verifyClaim(config, candidateRevision)
  await writeExclusive(join(directory, 'prepared.json'), claim)
}

export async function requirePreparation(config, candidateRevision) {
  const { directory, claim } = await verifyClaim(config, candidateRevision)
  const prepared = await readOwned(join(directory, 'prepared.json'))
  if (JSON.stringify(prepared) !== JSON.stringify(claim)) {
    throw new Error('Completed preparation does not match the runtime claim.')
  }
  return claim
}
