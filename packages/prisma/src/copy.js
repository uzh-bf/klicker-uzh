const fs = require('fs')

fs.mkdirSync('dist/runtime', { recursive: true })
fs.copyFileSync('src/client/index.d.ts', 'dist/index.d.ts')
fs.copyFileSync('src/prisma/schema.prisma', 'dist/schema.prisma')
fs.copyFileSync(
  'src/client/runtime/index-browser.d.ts',
  'dist/runtime/index-browser.d.ts'
)
fs.copyFileSync('src/client/runtime/index.d.ts', 'dist/runtime/index.d.ts')
fs.copyFileSync(
  'src/client/libquery_engine-debian-openssl-1.1.x.so.node',
  'dist/libquery_engine-debian-openssl-1.1.x.so.node'
)
