const fs = require('fs-extra')
const path = require('path')

fs.copySync(
  path.resolve(__dirname, './prisma/client'),
  path.resolve(__dirname, '../dist/')
)
