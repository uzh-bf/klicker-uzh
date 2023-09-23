const fs = require('fs-extra')
const path = require('path')

fs.copySync(
  path.resolve(__dirname, './client'),
  path.resolve(__dirname, '../dist/')
)

fs.copyFileSync(
  path.resolve(__dirname, './client/pothos.ts'),
  path.resolve(__dirname, '../../graphql/src/pothos-types.ts')
)
