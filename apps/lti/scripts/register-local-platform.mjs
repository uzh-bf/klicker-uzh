// Registers a synthetic LTI 1.3 platform with the local LTI service so that
// end-to-end tests can run the full launch protocol against a mocked LMS.
// Runs inside the devcontainer only:
//   node apps/lti/scripts/register-local-platform.mjs <base64url JSON>
// The JSON is an ltijs platform definition, normally with RSA_KEY auth.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Provider } = require('ltijs')
const Database = require('ltijs-sequelize')

if (process.env.LTI_DEV_MODE !== 'true') {
  console.error('Refusing to register a platform outside LTI dev mode')
  process.exit(1)
}

const platform = JSON.parse(
  Buffer.from(process.argv[2] ?? '', 'base64url').toString('utf8')
)

Provider.setup(
  process.env.LTI_ENCRYPTION_KEY,
  {
    plugin: new Database(
      process.env.LTI_DB_NAME,
      process.env.LTI_DB_USER,
      process.env.LTI_DB_PASS,
      {
        host: process.env.LTI_DB_HOST,
        port: process.env.LTI_DB_PORT ?? 5432,
        dialect: 'postgres',
        dialectOptions: { ssl: process.env.NODE_ENV !== 'development' },
        logging: false,
      }
    ),
  },
  { devMode: true }
)

await Provider.deploy({ serverless: true, silent: true })
const registered = await Provider.registerPlatform(platform)
console.log(JSON.stringify({ kid: await registered.platformKid() }))
await Provider.close({ silent: true })
