const fs = require('fs-extra')
const path = require('path')

fs.copySync(
  path.resolve(__dirname, './client'),
  path.resolve(__dirname, '../dist/')
)

fs.copySync(
  path.resolve(__dirname, './types.ts'),
  path.resolve(__dirname, '../dist/types.ts')
)
