// import { PrismaPg } from '@prisma/adapter-pg'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  // experimental: {
  //   adapter: true,
  // },
  schema: 'src/prisma/schema',
  migrations: {
    path: 'src/prisma/schema/migrations',
    seed: 'pnpm run seed',
  },
  views: {
    path: 'src/prisma/schema/views',
  },
  typedSql: {
    path: 'src/prisma/schema/queries',
  },
  // TODO: switch to using adapter instead of datasource at some point (was buggy when tested)
  // async adapter() {
  //   return new PrismaPg({
  //     connectionString: process.env.DATABASE_URL,
  //   })
  // },
})
