import fs from 'fs-extra'

fs.copy('../../packages/prisma/dist', './dist/client')
fs.copy('../../packages/prisma/dist', './src/client')
fs.copy('../../packages/prisma/dist/schema.prisma', './dist/schema.prisma')
