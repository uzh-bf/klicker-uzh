import base from './playwright.config.ts'

const resolverArg =
  '--host-resolver-rules=MAP *.klicker.localhost 192.168.156.4,EXCLUDE localhost'

export default {
  ...base,
  use: {
    ...base.use,
    launchOptions: {
      ...base.use?.launchOptions,
      args: [...(base.use?.launchOptions?.args ?? []), resolverArg],
    },
  },
}
