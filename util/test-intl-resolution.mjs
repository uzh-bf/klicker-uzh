import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const app = process.argv[2]
if (
  ![
    'frontend-pwa',
    'frontend-manage',
    'frontend-control',
    'auth',
    'chat',
  ].includes(app)
) {
  throw new Error('Pass a frontend app directory name')
}

function resolveContext(directory) {
  const require = createRequire(resolve(directory, 'package.json'))
  const nextIntl = realpathSync(require.resolve('next-intl'))
  const intlRequire = createRequire(nextIntl)
  const useIntl = realpathSync(intlRequire.resolve('use-intl'))
  const react = realpathSync(intlRequire.resolve('react'))
  return { nextIntl, useIntl, react }
}

const provider = resolveContext(`apps/${app}`)
const contexts = { [`apps/${app}`]: provider }
for (const importer of ['packages/shared-components', 'packages/i18n']) {
  const context = resolveContext(importer)
  contexts[importer] = context
  assert.deepEqual(
    context,
    provider,
    `${app}: ${importer} resolves a different translation context`
  )
}
console.log(JSON.stringify({ app, contexts }))
