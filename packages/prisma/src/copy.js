const fs = require('fs')
const path = require('path')

fs.mkdirSync(path.resolve(__dirname, '../dist/runtime'), { recursive: true })
fs.copyFileSync(
  path.resolve(__dirname, './client/index.d.ts'),
  path.resolve(__dirname, '../dist/index.d.ts')
)
fs.copyFileSync(
  path.resolve(__dirname, './prisma/schema.prisma'),
  path.resolve(__dirname, '../dist/schema.prisma')
)
fs.copyFileSync(
  path.resolve(__dirname, './client/runtime/index-browser.d.ts'),
  path.resolve(__dirname, '../dist/runtime/index-browser.d.ts')
)
fs.copyFileSync(
  path.resolve(__dirname, './client/runtime/index.d.ts'),
  path.resolve(__dirname, '../dist/runtime/index.d.ts')
)
fs.copyFileSync(
  path.resolve(
    __dirname,
    // './client/libquery_engine-debian-openssl-1.1.x.so.node'
    // "./client/query_engine-windows.dll.node"
    './client/libquery_engine-linux-musl-openssl-3.0.x.so.node'
  ),
  path.resolve(
    __dirname,
    // '../dist/libquery_engine-debian-openssl-1.1.x.so.node'
    // '../dist/query_engine-windows.dll.node'
    '../dist/libquery_engine-linux-musl-openssl-3.0.x.so.node'
  )
)
