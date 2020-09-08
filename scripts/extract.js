/* eslint-disable */

const { readFileSync, writeFileSync } = require('fs')
const { resolve } = require('path')
const glob = require('glob')
const { execFileSync } = require('child_process')

// formatjs cli doesn't currently support globbing, so we perform it ourselves
// as a workaround. see https://github.com/formatjs/formatjs/issues/383
const sourceFiles = glob.sync(process.argv[2])
execFileSync('npx', [
  'formatjs',
  'extract',
  '--messages-dir',
  './src/lang/.messages/',
  '--remove-default-message',
  ...sourceFiles,
])

const defaultMessages = glob
  .sync('./src/lang/.messages/**/*.json')
  .map((filename) => readFileSync(filename, 'utf8'))
  .map((file) => JSON.parse(file))
  .reduce((messages, descriptors) => {
    descriptors.forEach(({ id, defaultMessage }) => {
      if (messages.hasOwnProperty(id) && messages[id] !== defaultMessage) {
        throw new Error(
          `Duplicate message id: ${id} (duplicate message ids are allowed, but only if the defaultMessages match!)`
        )
      }
      messages[id] = defaultMessage
    })
    return messages
  }, {})

writeFileSync('./src/lang/en.json', JSON.stringify(defaultMessages, null, 2))
console.log(`> Wrote default messages to: "${resolve('./src/lang/en.json')}"`)
