import {
  BENIBOT_CHATBOT_ID,
  createFalkorDBClient,
  loadFalkorDBConfig,
  seedPrototypeFinanceGraph,
  type FalkorDBEnv,
} from './index.js'

type SeedCliArgs = {
  chatbotId: string
  reset: boolean
}

const LOCAL_FALKORDB_DEFAULTS: FalkorDBEnv = {
  FALKORDB_HOST: '127.0.0.1',
  FALKORDB_PASSWORD: 'falkordb',
  FALKORDB_PORT: '6382',
  FALKORDB_USERNAME: 'default',
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const client = createFalkorDBClient(
    loadFalkorDBConfig({
      ...LOCAL_FALKORDB_DEFAULTS,
      ...process.env,
    })
  )

  try {
    const result = await seedPrototypeFinanceGraph({
      chatbotId: args.chatbotId,
      client,
      reset: args.reset,
    })

    console.log(
      `Seeded ${result.nodeCount} nodes and ${result.relationshipCount} relationships into ${result.graphName}`
    )
  } finally {
    await client.quit?.()
  }
}

function parseArgs(rawArgs: string[]): SeedCliArgs {
  let chatbotId = BENIBOT_CHATBOT_ID
  let reset = false

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (!arg) continue

    if (arg === '--reset') {
      reset = true
      continue
    }

    if (arg === '--chatbot-id') {
      const nextArg = rawArgs[index + 1]
      if (!nextArg) {
        throw new Error('--chatbot-id requires a UUID value')
      }

      chatbotId = nextArg
      index += 1
      continue
    }

    if (arg.startsWith('--chatbot-id=')) {
      chatbotId = arg.slice('--chatbot-id='.length)
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return {
    chatbotId,
    reset,
  }
}

await main().catch((error) => {
  console.error(error)
  process.exit(1)
})
