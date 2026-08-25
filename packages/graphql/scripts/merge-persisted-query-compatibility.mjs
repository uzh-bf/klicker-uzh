import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const serverManifestPath = path.join(packageRoot, 'src/public/server.json')
const legacyGetCockpitQuizHash =
  '26315050abef8a4f7daf07d2c424b31fbc05e99672bfa2c8f612b07c740bc5f8'

const serverManifest = JSON.parse(await readFile(serverManifestPath, 'utf8'))
const currentGetCockpitQuiz = Object.values(serverManifest).find(
  (query) =>
    typeof query === 'string' &&
    query.includes('query GetCockpitQuiz($id: String!)') &&
    query.includes('numOfResponsesReceived') &&
    query.includes('numOfResponsesProcessed')
)

if (typeof currentGetCockpitQuiz !== 'string') {
  throw new Error('Could not find the current GetCockpitQuiz persisted query')
}

const legacyGetCockpitQuiz = currentGetCockpitQuiz.replace(
  '\n        numOfResponsesReceived\n        numOfResponsesProcessed',
  ''
)
const actualLegacyHash = createHash('sha256')
  .update(legacyGetCockpitQuiz)
  .digest('hex')

if (actualLegacyHash !== legacyGetCockpitQuizHash) {
  throw new Error(
    `Legacy GetCockpitQuiz compatibility query hash changed: ${actualLegacyHash}`
  )
}

serverManifest[legacyGetCockpitQuizHash] = legacyGetCockpitQuiz
await writeFile(
  serverManifestPath,
  `${JSON.stringify(serverManifest, null, 3)}\n`
)
