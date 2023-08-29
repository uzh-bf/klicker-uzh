import * as fs from 'fs'

try {
  fs.rmdirSync('./dist', { recursive: true })
} catch (e) {}

fs.mkdirSync('./dist/')

fs.copyFileSync(
  '../../packages/prisma/dist/schema.prisma',
  './dist/schema.prisma'
)
